import { prisma } from "@/lib/prisma";
import { employmentService } from "@/services/employment.service";
import { actionService } from "@/services/action.service";
import { telegramService } from "@/services/telegram.service";
import {
  normalizeTelegramChatId,
  telegramChatIdCandidates,
} from "@/lib/telegram-id";

export class GroupService {
  async upsertFromTelegram(input: {
    telegramId: string;
    name?: string | null;
    adminTelegramIds?: string[] | null;
    memberCount?: number | null;
    description?: string | null;
    botStatus?: string | null;
  }) {
    const telegramId = normalizeTelegramChatId(input.telegramId);
    const adminJson =
      input.adminTelegramIds && input.adminTelegramIds.length > 0
        ? JSON.stringify(input.adminTelegramIds)
        : undefined;

    const group = await prisma.telegramGroup.upsert({
      where: { telegramId },
      create: {
        telegramId,
        name: input.name ?? null,
        adminTelegramIds: adminJson ?? null,
        memberCount: input.memberCount ?? null,
        description: input.description ?? null,
        botStatus: input.botStatus ?? "member",
        lastBotEventAt: new Date(),
        settings: {
          create: {
            enabled: false,
            welcomeMembers: true,
            replyToMentions: true,
            answerQuestions: true,
            spamModeration: true,
            mentionNotifications: true,
            dailySummaryHour: 9,
          },
        },
      },
      update: {
        name: input.name ?? undefined,
        adminTelegramIds: adminJson,
        memberCount: input.memberCount ?? undefined,
        description: input.description ?? undefined,
        botStatus: input.botStatus ?? undefined,
        lastBotEventAt: new Date(),
      },
      include: { settings: true },
    });

    return group;
  }

  /** Resolve a Telegram group from DB, trying common ID variants. */
  async findByTelegramIdVariants(rawTelegramId: string) {
    for (const candidate of telegramChatIdCandidates(rawTelegramId)) {
      const group = await prisma.telegramGroup.findUnique({
        where: { telegramId: candidate },
        include: { settings: true },
      });
      if (group) return group;
    }
    return null;
  }

  /**
   * If the bot can see the chat on Telegram but it was never stored
   * (missed my_chat_member / webhook down), import it now.
   */
  async importFromTelegramApi(rawTelegramId: string) {
    let chat: Awaited<ReturnType<typeof telegramService.getChat>> | null = null;
    let resolvedId: string | null = null;

    for (const candidate of telegramChatIdCandidates(rawTelegramId)) {
      try {
        chat = await telegramService.getChat(candidate);
        resolvedId = String(chat.id);
        break;
      } catch {
        // try next candidate
      }
    }

    if (!chat || !resolvedId) {
      throw new Error(
        "Group not found. Add the Sentry bot to the Telegram group as a member (admin recommended), then try again with the full chat ID (usually starts with -100).",
      );
    }

    if (chat.type !== "group" && chat.type !== "supergroup") {
      throw new Error("That chat ID is not a group or supergroup.");
    }

    let adminIds: string[] = [];
    try {
      const admins = await telegramService.getChatAdministrators(resolvedId);
      adminIds = admins.map((a) => String(a.user.id));
    } catch {
      adminIds = [];
    }

    const memberCount = await telegramService.getChatMemberCount(resolvedId);

    return this.upsertFromTelegram({
      telegramId: resolvedId,
      name: chat.title ?? null,
      description: chat.description ?? null,
      adminTelegramIds: adminIds,
      memberCount,
      botStatus: "member",
    });
  }

  async listForUser(userId: string) {
    const links = await prisma.groupEmployment.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            settings: true,
            _count: { select: { faqs: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = [];
    for (const link of links) {
      const stats = await actionService.groupStatsToday(link.groupId);
      result.push({
        id: link.group.id,
        telegramId: link.group.telegramId,
        name: link.group.name,
        memberCount: link.group.memberCount,
        enabled: link.enabled && (link.group.settings?.enabled ?? false),
        employmentEnabled: link.enabled,
        enabledByUserId: link.userId,
        settings: link.group.settings,
        faqCount: link.group._count.faqs,
        ...stats,
      });
    }

    return result;
  }

  async getForUser(userId: string, groupId: string) {
    const link = await prisma.groupEmployment.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: {
        group: {
          include: {
            settings: true,
            faqs: { orderBy: { createdAt: "asc" } },
            messages: { orderBy: { createdAt: "desc" }, take: 50 },
          },
        },
      },
    });

    if (!link) {
      throw new Error("Group not found for this account");
    }

    const stats = await actionService.groupStatsToday(groupId);

    return {
      id: link.group.id,
      telegramId: link.group.telegramId,
      name: link.group.name,
      description: link.group.description,
      purpose: link.group.purpose,
      rules: link.group.rules,
      memberCount: link.group.memberCount,
      adminTelegramIds: link.group.adminTelegramIds,
      enabledByUserId: link.userId,
      enabled: link.enabled && (link.group.settings?.enabled ?? false),
      settings: link.group.settings,
      faqs: link.group.faqs,
      recentMessages: [...link.group.messages].reverse(),
      ...stats,
    };
  }

  async enable(userId: string, telegramId: string) {
    await employmentService.assertCanWork(userId);

    let group = await this.findByTelegramIdVariants(telegramId);
    if (!group) {
      // Bot is already in the chat, but webhook never persisted it — import now.
      group = await this.importFromTelegramApi(telegramId);
    }

    if (group.botStatus === "removed") {
      throw new Error(
        "Sentry was removed from this group. Add the bot back, then enable again.",
      );
    }

    await prisma.groupSettings.upsert({
      where: { groupId: group.id },
      create: {
        groupId: group.id,
        enabled: true,
        welcomeMembers: true,
        replyToMentions: true,
        answerQuestions: true,
        spamModeration: true,
        mentionNotifications: true,
        dailySummaryHour: 9,
      },
      update: { enabled: true },
    });

    const link = await prisma.groupEmployment.upsert({
      where: { userId_groupId: { userId, groupId: group.id } },
      create: { userId, groupId: group.id, enabled: true },
      update: { enabled: true },
    });

    return {
      groupId: group.id,
      telegramId: group.telegramId,
      name: group.name,
      enabled: link.enabled,
      enabledByUserId: userId,
    };
  }

  async disable(userId: string, groupId: string) {
    const link = await prisma.groupEmployment.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!link) {
      throw new Error("Group not linked to this account");
    }

    await prisma.groupEmployment.update({
      where: { id: link.id },
      data: { enabled: false },
    });

    const remaining = await prisma.groupEmployment.count({
      where: { groupId, enabled: true },
    });
    if (remaining === 0) {
      await prisma.groupSettings.updateMany({
        where: { groupId },
        data: { enabled: false },
      });
    }

    return { groupId, enabled: false };
  }

  async updateSettings(
    userId: string,
    groupId: string,
    data: {
      welcomeMembers?: boolean;
      replyToMentions?: boolean;
      answerQuestions?: boolean;
      spamModeration?: boolean;
      mentionNotifications?: boolean;
      dailySummaryHour?: number;
      summaryToGroup?: boolean;
      summaryToAdmins?: boolean;
      summaryToPrivate?: boolean;
      shiftHandover?: boolean;
      escalationLadder?: boolean;
      livingPlaybook?: boolean;
      intentSensing?: boolean;
      proofOfWork?: boolean;
      incidentMode?: boolean;
      memberMemoryEnabled?: boolean;
      hireInTelegram?: boolean;
      personaRole?: string;
      personaTone?: string | null;
      rules?: string | null;
      description?: string | null;
      purpose?: string | null;
    },
  ) {
    await this.getForUser(userId, groupId);

    if (
      data.rules !== undefined ||
      data.description !== undefined ||
      data.purpose !== undefined
    ) {
      await prisma.telegramGroup.update({
        where: { id: groupId },
        data: {
          rules: data.rules === undefined ? undefined : data.rules,
          description:
            data.description === undefined ? undefined : data.description,
          purpose: data.purpose === undefined ? undefined : data.purpose,
        },
      });
    }

    const hour =
      data.dailySummaryHour !== undefined
        ? Math.min(23, Math.max(0, Math.floor(data.dailySummaryHour)))
        : undefined;

    const settings = await prisma.groupSettings.upsert({
      where: { groupId },
      create: {
        groupId,
        enabled: true,
        welcomeMembers: data.welcomeMembers ?? true,
        replyToMentions: data.replyToMentions ?? true,
        answerQuestions: data.answerQuestions ?? true,
        spamModeration: data.spamModeration ?? true,
        mentionNotifications: data.mentionNotifications ?? true,
        dailySummaryHour: hour ?? 9,
        summaryToGroup: data.summaryToGroup ?? true,
        summaryToAdmins: data.summaryToAdmins ?? true,
        summaryToPrivate: data.summaryToPrivate ?? true,
        shiftHandover: data.shiftHandover ?? true,
        escalationLadder: data.escalationLadder ?? true,
        livingPlaybook: data.livingPlaybook ?? true,
        intentSensing: data.intentSensing ?? true,
        proofOfWork: data.proofOfWork ?? true,
        incidentMode: data.incidentMode ?? true,
        memberMemoryEnabled: data.memberMemoryEnabled ?? false,
        hireInTelegram: data.hireInTelegram ?? true,
        personaRole: data.personaRole ?? "default",
        personaTone: data.personaTone ?? null,
      },
      update: {
        welcomeMembers: data.welcomeMembers,
        replyToMentions: data.replyToMentions,
        answerQuestions: data.answerQuestions,
        spamModeration: data.spamModeration,
        mentionNotifications: data.mentionNotifications,
        dailySummaryHour: hour,
        summaryToGroup: data.summaryToGroup,
        summaryToAdmins: data.summaryToAdmins,
        summaryToPrivate: data.summaryToPrivate,
        shiftHandover: data.shiftHandover,
        escalationLadder: data.escalationLadder,
        livingPlaybook: data.livingPlaybook,
        intentSensing: data.intentSensing,
        proofOfWork: data.proofOfWork,
        incidentMode: data.incidentMode,
        memberMemoryEnabled: data.memberMemoryEnabled,
        hireInTelegram: data.hireInTelegram,
        personaRole: data.personaRole,
        personaTone: data.personaTone,
      },
    });

    return settings;
  }

  async findActiveGroupByTelegramId(telegramId: string) {
    for (const candidate of telegramChatIdCandidates(telegramId)) {
      const group = await prisma.telegramGroup.findUnique({
        where: { telegramId: candidate },
        include: {
          settings: true,
          employment: {
            where: { enabled: true },
            include: { user: { include: { employment: true, wallet: true } } },
          },
        },
      });
      if (group) return group;
    }
    return null;
  }
}

export const groupService = new GroupService();
