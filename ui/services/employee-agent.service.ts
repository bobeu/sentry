import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { isGrandAdminTelegramId } from "@/lib/owner";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { faqService } from "@/services/faq.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { walletService } from "@/services/wallet.service";
import { formatAmount } from "@/lib/payment-currency";
import {
  adminModerationService,
  parseDurationSeconds,
  type ModerationAction,
} from "@/services/admin-moderation.service";
import { engagementService } from "@/services/engagement.service";
import { employerDmService } from "@/services/employer-dm.service";
import { askbotService } from "@/services/askbot.service";
import { analyticsService } from "@/services/analytics.service";
import { memoryService } from "@/services/memory.service";
import { groupService } from "@/services/group.service";
import { groupReplyService } from "@/services/group-reply.service";
import type { User, Employment, Wallet, Settings } from "@/generated/client";

export const EMPLOYEE_TASKS = [
  "status",
  "summarize_thread",
  "answer_faq",
  "generate_reply",
  "resolve_identity",
  "get_context",
  "wallet_status",
  "list_groups",
  "points_status",
  "moderation",
  "start_engagement",
  "engagement_event",
  "engagement_status",
  "log_group_message",
  "evaluate_group_reply",
  "employer_help",
  "remember",
  "forget",
  "askbot",
  "analytics_overview",
  "employer_callback",
] as const;

export type EmployeeTask = (typeof EMPLOYEE_TASKS)[number];

export type AgentUser = User & {
  employment: Employment | null;
  wallet: Wallet | null;
  settings: Settings | null;
};

export type EmployeeTaskInput = {
  task: EmployeeTask;
  telegramUserId?: string;
  chatId?: string;
  groupId?: string;
  question?: string;
  messageText?: string;
  targetUserId?: string;
  duration?: string;
  moderationAction?: ModerationAction;
  engagementKind?: "poll" | "trivia" | "campaign" | "fun";
  engagementEventKind?:
    | "poll_answer"
    | "quiz_callback"
    | "cast_vote"
    | "game_text";
  campaignUrl?: string;
  memoryNote?: string;
  callbackData?: string;
  pollId?: string;
  optionIds?: number[];
  optionIndex?: number;
  username?: string;
  addressed?: boolean;
  chatType?: "private" | "group" | "supergroup" | "channel";
  botUsername?: string;
  telegramMessageId?: string;
};

export type EmployeeTaskResult = {
  result: unknown;
  billable: boolean;
  groupId?: string | null;
  metadata?: Record<string, unknown>;
};

async function requireGroupLink(userId: string, groupId: string) {
  const link = await prisma.groupEmployment.findUnique({
    where: { userId_groupId: { userId, groupId } },
    include: { group: { include: { settings: true } } },
  });
  if (!link) throw Errors.groupNotFound();
  return link;
}

async function resolveEmployerGroup(
  userId: string,
  input: { groupId?: string; chatId?: string },
) {
  if (input.groupId) {
    return requireGroupLink(userId, input.groupId);
  }
  if (input.chatId) {
    const group = await prisma.telegramGroup.findFirst({
      where: { telegramId: String(input.chatId) },
      include: { settings: true },
    });
    if (!group) throw Errors.groupNotFound();
    return requireGroupLink(userId, group.id);
  }
  throw Errors.badRequest("groupId or chatId required");
}

export class EmployeeAgentService {
  async execute(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const task = input.task;

    if (task === "analytics_overview" || task === "askbot") {
      if (!isGrandAdminTelegramId(input.telegramUserId)) {
        throw Errors.forbidden();
      }
    }

    switch (task) {
      case "status":
        return this.status(user);
      case "resolve_identity":
        return this.resolveIdentity(input.telegramUserId);
      case "summarize_thread":
        return this.summarizeThread(user, input.groupId);
      case "answer_faq":
      case "generate_reply":
        return this.generateReply(user, input);
      case "get_context":
        return this.getContext(user, input.groupId);
      case "wallet_status":
        return this.walletStatus(user, input.telegramUserId);
      case "list_groups":
        return this.listGroups(user);
      case "points_status":
        return this.pointsStatus(user, input);
      case "moderation":
        return this.moderation(user, input);
      case "start_engagement":
        return this.startEngagement(user, input);
      case "engagement_event":
        return this.engagementEvent(user, input);
      case "engagement_status":
        return this.engagementStatus(user, input);
      case "log_group_message":
        return this.logGroupMessage(input);
      case "evaluate_group_reply":
        return this.evaluateGroupReply(input);
      case "employer_help":
        return this.employerHelp(user, input);
      case "remember":
        return this.remember(user, input);
      case "forget":
        return this.forget(user, input);
      case "askbot":
        return this.askbot();
      case "analytics_overview":
        return this.analytics();
      case "employer_callback":
        return this.employerCallback(user, input);
      default:
        throw Errors.badRequest(`Unknown task: ${task}`);
    }
  }

  private async status(user: AgentUser): Promise<EmployeeTaskResult> {
    const ledger = await billingService.getBalanceLedger(user.id);
    const groups = await prisma.groupEmployment.count({
      where: { userId: user.id, enabled: true },
    });
    return {
      billable: true,
      result: {
        employment: user.employment?.status ?? "None",
        enabledGroups: groups,
        availableBalance: ledger.availableBalance,
        currency: ledger.currency,
        telegramUserId: user.settings?.telegramUserId ?? null,
      },
    };
  }

  private async resolveIdentity(
    telegramUserId?: string,
  ): Promise<EmployeeTaskResult> {
    if (!telegramUserId) {
      return {
        billable: false,
        result: { linked: false, reason: "telegramUserId required" },
      };
    }
    const settings = await prisma.settings.findFirst({
      where: { telegramUserId },
      include: {
        user: { include: { employment: true, wallet: true } },
      },
    });
    if (!settings?.user) {
      return {
        billable: false,
        result: {
          linked: false,
          telegramUserId,
          isGrandAdmin: isGrandAdminTelegramId(telegramUserId),
          hint: "Sign in at the Sentry dashboard and link Telegram user ID in Settings.",
        },
      };
    }
    return {
      billable: false,
      result: {
        linked: true,
        telegramUserId,
        userId: settings.user.id,
        email: settings.user.email,
        employment: settings.user.employment?.status ?? "None",
        hasWallet: Boolean(settings.user.wallet),
        isGrandAdmin: isGrandAdminTelegramId(telegramUserId),
      },
    };
  }

  private async summarizeThread(
    user: AgentUser,
    groupId?: string,
  ): Promise<EmployeeTaskResult> {
    if (!groupId) throw Errors.badRequest("groupId required");
    await requireGroupLink(user.id, groupId);
    const context = await contextService.build(groupId);
    const summary = await aiService.generateDailySummary(context);
    return {
      billable: true,
      groupId,
      result: { summary },
      metadata: { task: "summarize_thread" },
    };
  }

  private async generateReply(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const groupId = input.groupId;
    const question = (input.question ?? input.messageText ?? "").trim();
    if (!groupId || !question) {
      throw Errors.badRequest("groupId and question required");
    }
    await requireGroupLink(user.id, groupId);
    const faqs = await faqService.list(groupId);
    const faqAnswer = faqService.match(faqs, question);
    const context = await contextService.build(groupId);
    const reply = await aiService.generateReply({
      context,
      userQuestion: question,
      preferFaq: input.task === "answer_faq",
      groupId,
    });
    return {
      billable: true,
      groupId,
      result: {
        answer: reply.text,
        viaFaq: reply.viaFaq || Boolean(faqAnswer),
        faqAnswer: faqAnswer ?? null,
      },
      metadata: { task: input.task },
    };
  }

  private async getContext(
    user: AgentUser,
    groupId?: string,
  ): Promise<EmployeeTaskResult> {
    if (!groupId) throw Errors.badRequest("groupId required");
    await requireGroupLink(user.id, groupId);
    const context = await contextService.build(groupId);
    return {
      billable: true,
      groupId,
      result: {
        groupId: context.groupId,
        groupName: context.groupName,
        purpose: context.purpose,
        rules: context.rules,
        config: context.config,
        faqCount: context.faqs.length,
        recentMessageCount: context.recentMessages.length,
        recentMessages: context.recentMessages.slice(-20),
        faqs: context.faqs.slice(0, 30),
      },
    };
  }

  private async walletStatus(
    user: AgentUser,
    telegramUserId?: string,
  ): Promise<EmployeeTaskResult> {
    let target = user;
    if (telegramUserId && telegramUserId !== user.settings?.telegramUserId) {
      const settings = await prisma.settings.findFirst({
        where: { telegramUserId },
        include: {
          user: { include: { wallet: true, employment: true, settings: true } },
        },
      });
      if (!settings?.user) {
        return {
          billable: false,
          result: {
            ok: false,
            message:
              "Sign in at the Sentry dashboard and link your Telegram user ID in Settings first.",
          },
        };
      }
      target = settings.user as AgentUser;
    }

    const wallet = target.wallet;
    if (!wallet) {
      return {
        billable: false,
        result: {
          ok: false,
          message: "Hire Sentry in the dashboard to provision your employment wallet.",
        },
      };
    }

    const currency = wallet.walletCurrency as import("@/lib/payment-currency").PaymentCurrency;
    const synced = await walletService.syncBalanceFromChain(target.id);
    const balance = synced?.balance ?? Number(wallet.balance.toString());
    const ledger = await billingService.getBalanceLedger(target.id);

    return {
      billable: true,
      result: {
        ok: true,
        address: wallet.address,
        currency,
        balance,
        availableBalance: ledger.availableBalance,
        formattedBalance: formatAmount(balance, currency),
        formattedAvailable: formatAmount(ledger.availableBalance, currency),
        employment: target.employment?.status ?? "None",
      },
    };
  }

  private async listGroups(user: AgentUser): Promise<EmployeeTaskResult> {
    const links = await prisma.groupEmployment.findMany({
      where: { userId: user.id },
      include: { group: { include: { settings: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return {
      billable: true,
      result: {
        groups: links.map((link) => ({
          groupId: link.groupId,
          name: link.group.name,
          telegramId: link.group.telegramId,
          enabled: link.enabled,
          answerQuestions: link.group.settings?.answerQuestions ?? false,
          spamModeration: link.group.settings?.spamModeration ?? false,
        })),
      },
    };
  }

  private async pointsStatus(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.groupId) throw Errors.badRequest("groupId required");
    await requireGroupLink(user.id, input.groupId);
    const telegramUserId = input.telegramUserId;
    if (!telegramUserId) throw Errors.badRequest("telegramUserId required");

    const row = await prisma.memberPoints.findUnique({
      where: {
        groupId_telegramUserId: {
          groupId: input.groupId,
          telegramUserId,
        },
      },
    });

    return {
      billable: true,
      groupId: input.groupId,
      result: {
        points: row?.points ?? 0,
        lifetimePoints: row?.lifetimePoints ?? 0,
        username: row?.username ?? null,
      },
    };
  }

  private async moderation(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.groupId) throw Errors.badRequest("groupId required");
    if (!input.moderationAction) {
      throw Errors.badRequest("moderationAction required");
    }
    if (!input.targetUserId) throw Errors.badRequest("targetUserId required");

    const link = await requireGroupLink(user.id, input.groupId);
    if (!link.enabled) throw Errors.badRequest("Group is not enabled");

    const chatId = input.chatId ?? link.group.telegramId;
    const durationSec = parseDurationSeconds(input.duration);
    const settings = link.group.settings;
    const outcome = await adminModerationService.execute({
      groupId: input.groupId,
      telegramChatId: chatId,
      employerUserId: user.id,
      billable: true,
      action: input.moderationAction,
      targetUserId: input.targetUserId,
      durationSec,
      roseRelayEnabled: Boolean(settings?.roseRelayEnabled),
      roseBotUsername: settings?.roseBotUsername,
    });

    return {
      billable: false, // execute() already records admin_moderation when billable
      groupId: input.groupId,
      result: outcome,
      metadata: {
        task: "moderation",
        action: input.moderationAction,
      },
    };
  }

  private async startEngagement(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const link = await resolveEmployerGroup(user.id, input);
    if (!link.enabled) throw Errors.badRequest("Group is not enabled");
    const groupId = link.groupId;
    const settings = link.group.settings;
    const telegramChatId = link.group.telegramId;

    const kind = input.engagementKind ?? "poll";
    const context = await contextService.build(groupId);
    const hint = [input.messageText, input.question].filter(Boolean).join("\n").trim() || null;

    const { getBot } = await import("@/services/telegram.service");

    if (kind === "campaign" && input.campaignUrl) {
      const created = await engagementService.createSocialCampaign({
        groupId,
        targetUrl: input.campaignUrl,
        createdByUserId: user.id,
      });
      let delivered = false;
      let deliveryError: string | null = null;
      try {
        const bot = getBot();
        await bot.telegram.sendMessage(
          telegramChatId,
          engagementService.formatActivityBrief(created, settings),
        );
        delivered = true;
      } catch (err) {
        deliveryError = err instanceof Error ? err.message : String(err);
      }
      return {
        billable: true,
        groupId,
        result: {
          activity: created,
          delivered,
          deliveryError,
          deliveryMode: "text",
          instruction:
            "Campaign was created" +
            (delivered
              ? " and posted to the Telegram group. Confirm briefly — do NOT reprint options as plain text."
              : ". Posting failed; tell the user to retry. Do NOT invent a fake poll."),
        },
        metadata: { task: "start_engagement", kind, delivered },
      };
    }

    const typeMap = {
      poll: "poll",
      trivia: "learn",
      campaign: "social",
      fun: "fun",
    } as const;
    const invented = await engagementService.inventActivity({
      groupId,
      type: typeMap[kind],
      context,
      createdByUserId: user.id,
      hint,
      guidelines: settings?.engagementGuidelines,
    });

    let delivered = false;
    let deliveryError: string | null = null;
    let deliveryMode: "native_poll" | "inline_quiz" | "text" | "none" = "none";
    try {
      const bot = getBot();
      if (
        invented.type === "poll" ||
        invented.type === "learn" ||
        invented.type === "game" ||
        invented.type === "fun" ||
        invented.type === "comic"
      ) {
        const msg = await engagementService.postTelegramPoll(
          { telegram: bot.telegram, chatId: telegramChatId },
          invented,
          settings,
        );
        delivered = true;
        deliveryMode =
          msg && typeof msg === "object" && "poll" in msg && (msg as { poll?: unknown }).poll
            ? "native_poll"
            : "inline_quiz";
      } else {
        await bot.telegram.sendMessage(
          telegramChatId,
          engagementService.formatActivityBrief(invented, settings),
        );
        delivered = true;
        deliveryMode = "text";
      }
    } catch (err) {
      deliveryError = err instanceof Error ? err.message : String(err);
    }

    return {
      billable: true,
      groupId,
      result: {
        activity: {
          id: invented.id,
          title: invented.title,
          type: invented.type,
          pointsReward: invented.pointsReward,
          closesAt: invented.closesAt,
          telegramMsgId: invented.telegramMsgId,
          telegramPollId: invented.telegramPollId,
        },
        delivered,
        deliveryError,
        deliveryMode,
        instruction: delivered
          ? `Interactive ${kind} already posted to Telegram (${deliveryMode}). Reply with a short confirmation only — never paste the question/options as plain text, and never claim you cannot send native polls.`
          : `Activity was saved but Telegram delivery failed (${deliveryError ?? "unknown"}). Ask the user to retry /poll — do not invent a mock poll in chat.`,
      },
      metadata: { task: "start_engagement", kind, delivered, deliveryMode },
    };
  }

  /**
   * Record votes / quiz taps / typed answers for live engagement activities.
   * Member actions — not gated on employer prepaid balance at the route layer.
   */
  private async engagementEvent(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.telegramUserId) {
      throw Errors.badRequest("telegramUserId required");
    }

    const kind =
      input.engagementEventKind ??
      (input.pollId
        ? "poll_answer"
        : input.callbackData?.startsWith("q:")
          ? "quiz_callback"
          : "cast_vote");

    if (kind === "poll_answer") {
      if (!input.pollId) throw Errors.badRequest("pollId required");
      const optionIds =
        input.optionIds ??
        (typeof input.optionIndex === "number" ? [input.optionIndex] : []);
      const result = await engagementService.handlePollAnswer({
        pollId: input.pollId,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        optionIds,
      });
      if (!result) {
        return {
          billable: false,
          result: {
            ok: false,
            message: "No active poll matched that vote.",
          },
          metadata: { task: "engagement_event", kind },
        };
      }
      return {
        billable: false,
        groupId: result.activity.groupId,
        result: {
          ok: true,
          duplicate: result.duplicate,
          verified: result.verified,
          points: result.points,
          activityTitle: result.activity.title,
          message: result.duplicate
            ? `Already counted your vote on "${result.activity.title}".`
            : result.points > 0
              ? `Nice! +${result.points} pts for "${result.activity.title}".`
              : `Vote recorded on "${result.activity.title}". Points settle when the poll closes.`,
        },
        metadata: { task: "engagement_event", kind },
      };
    }

    if (kind === "quiz_callback") {
      const data = (input.callbackData ?? "").trim();
      const parts = data.split(":");
      const activityId = parts[1];
      const optionIndex = Number(parts[2]);
      if (!activityId || !Number.isFinite(optionIndex)) {
        throw Errors.badRequest("callbackData must look like q:{activityId}:{index}");
      }
      const scored = await engagementService.handleInlineQuizAnswer({
        activityId,
        optionIndex,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
      });
      const activity = await prisma.engagementActivity.findUnique({
        where: { id: activityId },
        select: { groupId: true },
      });
      return {
        billable: false,
        groupId: activity?.groupId,
        result: scored,
        metadata: { task: "engagement_event", kind, activityId },
      };
    }

    // cast_vote / game_text — resolve group then score typed choice ("option 1", option text, A/B)
    const link = await resolveEmployerGroup(user.id, input);
    const text = (input.messageText ?? input.question ?? "").trim();
    if (!text && typeof input.optionIndex !== "number") {
      throw Errors.badRequest("messageText or optionIndex required to cast a vote");
    }

    if (typeof input.optionIndex === "number" && !text) {
      const active = await prisma.engagementActivity.findFirst({
        where: {
          groupId: link.groupId,
          status: "active",
          type: { in: ["poll", "learn", "fun", "comic", "game"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!active) {
        return {
          billable: false,
          groupId: link.groupId,
          result: { ok: false, message: "No active poll or game to vote on." },
          metadata: { task: "engagement_event", kind },
        };
      }
      const scored = await engagementService.handleInlineQuizAnswer({
        activityId: active.id,
        optionIndex: input.optionIndex,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
      });
      return {
        billable: false,
        groupId: link.groupId,
        result: scored,
        metadata: { task: "engagement_event", kind, activityId: active.id },
      };
    }

    const scored = await engagementService.handleGameTextAnswer({
      groupId: link.groupId,
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      text,
    });
    if (!scored) {
      return {
        billable: false,
        groupId: link.groupId,
        result: {
          ok: false,
          message:
            "Could not match that to an active poll/game option. Ask them to tap the Telegram poll/buttons, or say e.g. option 1 / the option text.",
        },
        metadata: { task: "engagement_event", kind },
      };
    }
    return {
      billable: false,
      groupId: link.groupId,
      result: scored,
      metadata: { task: "engagement_event", kind },
    };
  }

  private async logGroupMessage(
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const text = (input.messageText ?? input.question ?? "").trim();
    if (!input.chatId || !text) {
      return {
        billable: false,
        result: { logged: false, reason: "chatId and messageText required" },
      };
    }

    const group = await groupService.upsertFromTelegram({
      telegramId: input.chatId,
    });

    if (input.telegramMessageId) {
      await contextService.appendMessage({
        groupId: group.id,
        telegramMessageId: input.telegramMessageId,
        fromUserId: input.telegramUserId ?? null,
        fromUsername: input.username ?? null,
        text,
      });
    }

    return {
      billable: false,
      groupId: group.id,
      result: { logged: true, groupId: group.id },
      metadata: { task: "log_group_message" },
    };
  }

  private async evaluateGroupReply(
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const evaluation = await groupReplyService.evaluate({
      chatId: input.chatId,
      chatType: input.chatType,
      messageText: input.messageText ?? input.question,
      telegramUserId: input.telegramUserId,
      addressed: input.addressed,
      botUsername: input.botUsername,
    });
    return {
      billable: false,
      result: evaluation,
      metadata: { task: "evaluate_group_reply", reason: evaluation.reason },
    };
  }

  private async engagementStatus(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const link = await resolveEmployerGroup(user.id, input);
    const summary = await engagementService.summarizeActiveForGroup(link.groupId);
    const active = await prisma.engagementActivity.findMany({
      where: { groupId: link.groupId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        type: true,
        pointsReward: true,
        closesAt: true,
        telegramMsgId: true,
        telegramPollId: true,
        configJson: true,
      },
    });
    return {
      billable: false,
      groupId: link.groupId,
      result: {
        summary,
        activities: active.map((a) => {
          let options: string[] = [];
          try {
            const cfg = JSON.parse(a.configJson) as { options?: string[] };
            options = Array.isArray(cfg.options) ? cfg.options.map(String) : [];
          } catch {
            options = [];
          }
          return {
            id: a.id,
            title: a.title,
            type: a.type,
            pointsReward: a.pointsReward,
            closesAt: a.closesAt,
            hasNativePoll: Boolean(a.telegramPollId),
            options,
          };
        }),
        instruction:
          "Answer from this live list. Prefer telling members to tap the Telegram poll/buttons. To register a typed vote, call engagement_event.",
      },
      metadata: { task: "engagement_status" },
    };
  }

  private async employerHelp(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    const text = (input.messageText ?? input.question ?? "").trim();
    const menu = employerDmService.mainMenuKeyboard();
    const capabilities = [
      "Wallet / balance / deposit",
      "Enable or configure groups",
      "Rewards hub",
      "Spam and work reports",
      "FAQ and playbook (dashboard)",
    ];

    return {
      billable: true,
      result: {
        message:
          text ||
          "Employer help: use the Sentry dashboard or ask about wallet, groups, rewards, or reports.",
        capabilities,
        replyMarkup: menu,
        employment: user.employment?.status ?? "None",
      },
    };
  }

  private async remember(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.groupId) throw Errors.badRequest("groupId required");
    if (!input.telegramUserId) throw Errors.badRequest("telegramUserId required");
    if (!input.memoryNote?.trim()) throw Errors.badRequest("memoryNote required");
    await requireGroupLink(user.id, input.groupId);
    await memoryService.remember({
      groupId: input.groupId,
      telegramUserId: input.telegramUserId,
      note: input.memoryNote.trim(),
      employerUserId: user.id,
      billable: true,
    });
    return {
      billable: false, // remember() may already bill
      groupId: input.groupId,
      result: { ok: true, saved: true },
    };
  }

  private async forget(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.groupId) throw Errors.badRequest("groupId required");
    if (!input.telegramUserId) throw Errors.badRequest("telegramUserId required");
    await requireGroupLink(user.id, input.groupId);
    await memoryService.forget(input.groupId, input.telegramUserId);
    return {
      billable: true,
      groupId: input.groupId,
      result: { ok: true, cleared: true },
    };
  }

  private async askbot(): Promise<EmployeeTaskResult> {
    const report = await askbotService.runEarnCycle({ maxProjects: 2 });
    return {
      billable: false,
      result: { report, skillPath: askbotService.skillPath() },
      metadata: { task: "askbot", privileged: true },
    };
  }

  private async analytics(): Promise<EmployeeTaskResult> {
    const overview = await analyticsService.overview();
    return {
      billable: false,
      result: overview,
      metadata: { task: "analytics_overview", privileged: true },
    };
  }

  /** Preserve employer DM inline-button flows for OpenClaw. */
  private async employerCallback(
    user: AgentUser,
    input: EmployeeTaskInput,
  ): Promise<EmployeeTaskResult> {
    if (!input.callbackData?.startsWith("emp:")) {
      throw Errors.badRequest("callbackData must start with emp:");
    }
    if (!input.telegramUserId) {
      throw Errors.badRequest("telegramUserId required");
    }

    let answerText: string | undefined;
    let message = "";
    let keyboard: unknown = null;

    const handled = await employerDmService.handleCallback({
      data: input.callbackData,
      userId: user.id,
      telegramUserId: input.telegramUserId,
      answerCb: async (text?: string) => {
        answerText = text;
      },
      editOrReply: async (text: string, kb?: unknown) => {
        message = text;
        keyboard = kb ?? null;
      },
    });

    return {
      billable: false,
      result: {
        handled,
        answerText: answerText ?? null,
        message,
        replyMarkup: keyboard,
      },
      metadata: { task: "employer_callback", data: input.callbackData },
    };
  }

  async recordBillable(
    userId: string,
    outcome: EmployeeTaskResult,
    task: EmployeeTask,
  ) {
    if (!outcome.billable) return;
    await actionService.record({
      type: "agent_task",
      userId,
      groupId: outcome.groupId ?? null,
      billable: true,
      metadata: { task, ...(outcome.metadata ?? {}) },
    });
  }
}

export const employeeAgentService = new EmployeeAgentService();
