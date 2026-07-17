import { prisma } from "@/lib/prisma";
import { employmentService } from "@/services/employment.service";
import { actionService } from "@/services/action.service";

export class GroupService {
  async upsertFromTelegram(input: {
    telegramId: string;
    name?: string | null;
    adminTelegramIds?: string[] | null;
    memberCount?: number | null;
    description?: string | null;
  }) {
    const adminJson =
      input.adminTelegramIds && input.adminTelegramIds.length > 0
        ? JSON.stringify(input.adminTelegramIds)
        : undefined;

    const group = await prisma.telegramGroup.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        name: input.name ?? null,
        adminTelegramIds: adminJson ?? null,
        memberCount: input.memberCount ?? null,
        description: input.description ?? null,
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
      },
      include: { settings: true },
    });

    return group;
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

    const group = await prisma.telegramGroup.findUnique({
      where: { telegramId },
      include: { settings: true },
    });
    if (!group) {
      throw new Error(
        "Group not found. Add the Sentry bot to the Telegram group first.",
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
      },
    });

    return settings;
  }

  async findActiveGroupByTelegramId(telegramId: string) {
    return prisma.telegramGroup.findUnique({
      where: { telegramId },
      include: {
        settings: true,
        employment: {
          where: { enabled: true },
          include: { user: { include: { employment: true, wallet: true } } },
        },
      },
    });
  }
}

export const groupService = new GroupService();
