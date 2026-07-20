import type { Telegraf, Context } from "telegraf";
import type { Prisma } from "@/generated/client";
import { groupService } from "@/services/group.service";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { actionService } from "@/services/action.service";
import { moderationService } from "@/services/moderation.service";
import { notificationService } from "@/services/notification.service";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { billingService } from "@/services/billing.service";
import { faqService } from "@/services/faq.service";
import { UNCERTAIN_REPLY } from "@/lib/messages";
import {
  detectEmployerIntent,
  employerAgentService,
} from "@/services/employer-agent.service";
import {
  botUsername,
  capabilitiesSummary,
  chatIdOf,
  findLinkedUserByTelegram,
  groupVisibilityHint,
  isAdminSender,
  isGroupChat,
  isPrivateChat,
  looksLikeQuestion,
  matchFaqForGroup,
  messageAddressesBot,
  resolveGroupRuntime,
  shouldOfferHelpOnly,
  stripBotMention,
  type GroupRuntime,
} from "@/telegram/runtime";

async function recordBillable(
  runtime: GroupRuntime,
  type: Parameters<typeof actionService.record>[0]["type"],
  metadata?: Prisma.InputJsonValue,
  billable = true,
) {
  if (!runtime.employerUserId) return;
  await actionService.record({
    type,
    groupId: runtime.group.id,
    userId: runtime.employerUserId,
    billable: billable && runtime.billable,
    metadata,
  });
}

async function replyTo(
  ctx: Context,
  text: string,
  replyToMessageId?: number,
) {
  try {
    if (replyToMessageId != null && ctx.chat) {
      await ctx.reply(text, {
        reply_parameters: { message_id: replyToMessageId },
      });
      return;
    }
    await ctx.reply(text);
  } catch (err) {
    console.warn("[telegram:reply]", err);
    await ctx.reply(text).catch(() => undefined);
  }
}

async function handleModeration(
  ctx: Context,
  runtime: GroupRuntime,
  text: string,
  fromUserId: string | null,
  fromUsername: string | null,
) {
  if (!runtime.communityMode || !runtime.group.settings?.spamModeration) return false;
  if (!runtime.billable || !runtime.employerUserId) return false;

  const verdict = moderationService.inspect({
    text,
    fromUserId,
    groupId: runtime.group.id,
  });
  if (!verdict.spam) return false;

  const confidence = verdict.confidence ?? 0;
  let actionTaken: "warn" | "notify_admin" | "delete" = "warn";
  const telegramId = chatIdOf(ctx) ?? runtime.group.telegramId;

  if (confidence < 0.7) {
    await ctx
      .reply(
        `Heads up — this looks off (${verdict.reason ?? "spam"}). Please keep the chat constructive.`,
      )
      .catch(() => undefined);
  } else if (confidence <= 0.9) {
    await ctx
      .reply(
        `This may be spam (${verdict.reason ?? "spam"}). I've flagged it for admins.`,
      )
      .catch(() => undefined);
    for (const adminId of runtime.adminTelegramIds.slice(0, 5)) {
      await ctx.telegram
        .sendMessage(
          Number(adminId),
          `Sentry moderation in ${runtime.group.name ?? telegramId}: possible spam (${verdict.reason}, ${(confidence * 100).toFixed(0)}%) from ${fromUsername ?? fromUserId}\n\n${text.slice(0, 400)}`,
        )
        .catch(() => undefined);
    }
    actionTaken = "notify_admin";
  } else {
    let deleted = false;
    try {
      if (ctx.message && "message_id" in ctx.message) {
        await ctx.deleteMessage(ctx.message.message_id);
        deleted = true;
      }
    } catch {
      // no delete permission
    }
    await ctx
      .reply(
        deleted
          ? `Removed a high-confidence spam message (${verdict.reason ?? "spam"}).`
          : `High-confidence spam (${verdict.reason ?? "spam"}), but I need delete permission to remove it.`,
      )
      .catch(() => undefined);
    for (const adminId of runtime.adminTelegramIds.slice(0, 5)) {
      await ctx.telegram
        .sendMessage(
          Number(adminId),
          `Sentry moderation in ${runtime.group.name ?? telegramId}: ${deleted ? "removed" : "flagged"} spam (${verdict.reason}) from ${fromUsername ?? fromUserId}`,
        )
        .catch(() => undefined);
    }
    actionTaken = deleted ? "delete" : "warn";
  }

  await recordBillable(runtime, "spam_moderation", {
    reason: verdict.reason,
    confidence: verdict.confidence,
    actionTaken,
  });
  return true;
}

async function agentAnswerForGroup(
  runtime: GroupRuntime,
  cleaned: string,
  fromUsername: string | null,
) {
  const context = await contextService.build(runtime.group.id);
  return aiService.generateReply({
    context,
    userQuestion: cleaned,
    userName: fromUsername ?? undefined,
  });
}

/**
 * Community Q&A: answer FAQs / agent replies for any member when configured,
 * or when Sentry is mentioned / replied to / addressed by an admin.
 */
async function handleGroupIntelligence(
  ctx: Context,
  runtime: GroupRuntime,
  text: string,
  fromUserId: string | null,
  fromUsername: string | null,
  addressed: boolean,
) {
  const username = await botUsername(ctx);
  const message = ctx.message && "message_id" in ctx.message ? ctx.message : null;
  if (!message || !("text" in message)) return;

  const fromAdmin = isAdminSender(runtime.adminTelegramIds, fromUserId);
  const cleaned = stripBotMention(text, username) || text;
  const settings = runtime.group.settings;

  // Mentions / replies always get a response — agent presence, not a mute bot.
  if (addressed) {
    if (shouldOfferHelpOnly(text, username)) {
      await replyTo(
        ctx,
        `${capabilitiesSummary(username)}\n\n${groupVisibilityHint(username)}`,
        message.message_id,
      );
      await recordBillable(runtime, "mention_reply", { kind: "capabilities" }, false);
      return;
    }

    if (!runtime.communityMode && !fromAdmin) {
      await replyTo(
        ctx,
        "This group hasn't fully activated community mode yet. An employer can enable Sentry from the dashboard Groups page.\n\n" +
          capabilitiesSummary(username),
        message.message_id,
      );
      await recordBillable(runtime, "mention_reply", { kind: "inactive_group" }, false);
      return;
    }

    // Admin tags outside community mode: still acknowledge + help (never silent).
    if (!runtime.communityMode && fromAdmin) {
      const faq = await matchFaqForGroup(runtime.group.id, cleaned);
      if (faq) {
        await replyTo(ctx, faq, message.message_id);
        await recordBillable(runtime, "faq_answer", { viaFaq: true, admin: true }, false);
        return;
      }
      await replyTo(
        ctx,
        "I see you — community mode isn't enabled for this group yet. Enable it on the dashboard Groups page so I can work for everyone.\n\n" +
          groupVisibilityHint(username),
        message.message_id,
      );
      await recordBillable(runtime, "mention_reply", { kind: "admin_inactive" }, false);
      return;
    }

    if (runtime.communityMode && !runtime.billable) {
      const faq = await matchFaqForGroup(runtime.group.id, cleaned);
      if (faq) {
        await replyTo(ctx, faq, message.message_id);
        await recordBillable(runtime, "faq_answer", { viaFaq: true, unfunded: true }, false);
        return;
      }
      await replyTo(
        ctx,
        "I'm online, but the employer wallet needs funds before I can run deeper agent work. FAQs still work when they match.\n\n" +
          capabilitiesSummary(username),
        message.message_id,
      );
      await recordBillable(runtime, "mention_reply", { kind: "unfunded" }, false);
      return;
    }

    // Community + funded + addressed → full agent (FAQ only on strong match).
    if (!settings?.replyToMentions && !settings?.answerQuestions) {
      await replyTo(
        ctx,
        "I'm here, but reply/Q&A settings are off for this group. An employer can turn them on in the dashboard.",
        message.message_id,
      );
      return;
    }

    try {
      const result = await agentAnswerForGroup(runtime, cleaned, fromUsername);
      await replyTo(ctx, result.text, message.message_id);
      await recordBillable(runtime, result.viaFaq ? "faq_answer" : "mention_reply", {
        viaFaq: result.viaFaq,
        fromAdmin,
      });
    } catch (err) {
      console.error("[agent:mention]", err);
      const faq = await matchFaqForGroup(runtime.group.id, cleaned);
      await replyTo(ctx, faq ?? UNCERTAIN_REPLY, message.message_id).catch(() => undefined);
      await recordBillable(runtime, "mention_reply", { failed: true }, false);
    }
    return;
  }

  // Without mention: community Q&A — needs privacy-off or admin so Telegram delivers the update.
  if (!runtime.communityMode || !settings?.answerQuestions) return;

  const faq = await matchFaqForGroup(runtime.group.id, cleaned);
  if (!faq && !looksLikeQuestion(cleaned)) return;

  if (!runtime.billable) {
    if (faq) {
      await replyTo(ctx, faq, message.message_id);
      await recordBillable(runtime, "faq_answer", { viaFaq: true, unfunded: true }, false);
    }
    return;
  }

  try {
    const result = faq
      ? { text: faq, viaFaq: true as const }
      : await agentAnswerForGroup(runtime, cleaned, fromUsername);
    await replyTo(ctx, result.text, message.message_id);
    await recordBillable(runtime, result.viaFaq ? "faq_answer" : "mention_reply", {
      viaFaq: result.viaFaq,
      proactive: true,
    });
  } catch (err) {
    console.error("[agent:proactive]", err);
    if (faq) {
      await replyTo(ctx, faq, message.message_id).catch(() => undefined);
    }
  }
}

async function handlePrivateAgent(ctx: Context, text: string) {
  const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
  const linked = await findLinkedUserByTelegram(fromUserId);
  const username = await botUsername(ctx);

  if (!linked?.user) {
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        "Personal mode: sign in on the dashboard and link your Telegram user ID under Settings, then hire & fund Sentry.",
      ].join("\n"),
    );
    return;
  }

  const user = linked.user;
  const active = user.employment?.status === "Active";
  const cleaned = stripBotMention(text, username) || text;
  const intent = detectEmployerIntent(cleaned);

  if (intent === "help" || shouldOfferHelpOnly(text, username) || /\/help/i.test(text)) {
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        `Linked account: ${user.email}`,
        `Employment: ${user.employment?.status ?? "Inactive"}`,
        active
          ? 'Ask anything — or try: "group status", "past work", "full report".'
          : "Hire Sentry in the dashboard to unlock personal agent work.",
      ].join("\n"),
    );
    return;
  }

  if (!active || !user.wallet) {
    await ctx.reply(
      "Your account is linked, but Sentry isn't actively employed yet. Hire and fund the employment wallet in the dashboard, then ask again.",
    );
    return;
  }

  try {
    const ledger = await billingService.getBalanceLedger(user.id);
    if (ledger.availableBalance <= 0) {
      await ctx.reply(
        "I'm ready, but your employment wallet has no available balance. Deposit funds, then ask me anything.",
      );
      return;
    }

    // Structured employer reports — deterministic data, then optional AI polish for "general".
    if (intent === "status" || intent === "work" || intent === "report") {
      const report = await employerAgentService.formatDirectReport(user.id, intent);
      const textOut =
        report.length > 3500 ? `${report.slice(0, 3490)}\n…` : report;
      await ctx.reply(textOut);
      await actionService.record({
        type: "mention_reply",
        userId: user.id,
        billable: true,
        metadata: { channel: "private", intent, report: true },
      });
      return;
    }

    const link = await prisma.groupEmployment.findFirst({
      where: { userId: user.id, enabled: true },
      include: { group: { include: { settings: true, faqs: true } } },
      orderBy: { updatedAt: "desc" },
    });

    const brief = await employerAgentService.buildOperationalBrief(user.id, intent);
    const displayName = ctx.from?.username ?? ctx.from?.first_name ?? undefined;

    // Strong FAQ hits still answer instantly; everything else uses the full agent.
    if (link?.group.settings?.enabled) {
      const faqs = link.group.faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
      }));
      const faqHit = faqService.matchDetailed(faqs, cleaned);
      if (faqHit && faqHit.score >= 0.72) {
        await ctx.reply(faqHit.answer);
        await actionService.record({
          type: "faq_answer",
          groupId: link.groupId,
          userId: user.id,
          billable: true,
          metadata: { channel: "private", viaFaq: true, intent },
        });
        return;
      }

      const context = await contextService.build(link.group.id);
      const textOut = await aiService.generatePersonalReply({
        userQuestion: cleaned,
        userName: displayName,
        employerEmail: user.email,
        operationalBrief: [
          brief,
          "",
          `Active group: ${context.groupName}`,
          `Purpose: ${context.purpose ?? "(none)"}`,
          `Recent chat:\n${context.recentMessages
            .slice(-12)
            .map((m) => `${m.from}: ${m.text}`)
            .join("\n") || "(none)"}`,
          `FAQs:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n") || "(none)"}`,
        ].join("\n"),
      });
      await ctx.reply(textOut);
      await actionService.record({
        type: "mention_reply",
        groupId: link.groupId,
        userId: user.id,
        billable: true,
        metadata: { channel: "private", viaFaq: false, intent },
      });
      return;
    }

    const textOut = await aiService.generatePersonalReply({
      userQuestion: cleaned,
      userName: displayName,
      employerEmail: user.email,
      operationalBrief: brief,
    });
    await ctx.reply(textOut);
    await actionService.record({
      type: "mention_reply",
      userId: user.id,
      billable: true,
      metadata: { channel: "private", personal: true, intent },
    });
  } catch (err) {
    console.error("[agent:private]", err);
    await ctx.reply(UNCERTAIN_REPLY).catch(() => undefined);
  }
}

export function registerHandlers(bot: Telegraf) {
  bot.catch((err) => {
    console.error("[telegram]", err);
  });

  bot.on("my_chat_member", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const chat = ctx.chat;
    if (!chat || !("title" in chat)) return;

    const member = ctx.myChatMember.new_chat_member;
    const status = member.status;
    const telegramId = chatIdOf(ctx) ?? String(chat.id);

    if (status === "kicked" || status === "left") {
      const group = await prisma.telegramGroup.findUnique({ where: { telegramId } });
      if (group) {
        await prisma.groupSettings.updateMany({
          where: { groupId: group.id },
          data: { enabled: false },
        });
        await prisma.telegramGroup.update({
          where: { id: group.id },
          data: { botStatus: "removed", lastBotEventAt: new Date() },
        });
      }
      logEvent("Bot Removed", { telegramId });
      return;
    }

    if (status !== "member" && status !== "administrator") return;

    const admins = await ctx.telegram.getChatAdministrators(chat.id).catch(() => []);
    const adminIds = admins.map((a) => String(a.user.id));
    const me = await ctx.telegram.getMe();
    const meAdmin = admins.find((a) => a.user.id === me.id);
    const canDelete =
      meAdmin?.status === "creator" ||
      (meAdmin?.status === "administrator" &&
        "can_delete_messages" in meAdmin &&
        Boolean(meAdmin.can_delete_messages));

    await groupService.upsertFromTelegram({
      telegramId,
      name: chat.title,
      adminTelegramIds: adminIds,
      memberCount:
        "member_count" in chat
          ? ((chat as { member_count?: number }).member_count ?? null)
          : null,
      botStatus: status === "administrator" ? "active" : "member",
    });

    await prisma.telegramGroup.updateMany({
      where: { telegramId },
      data: {
        botStatus: status === "administrator" ? "active" : "member",
        botCanDelete: Boolean(canDelete),
        lastBotEventAt: new Date(),
      },
    });

    const username = (me.username ?? "tgemployee_bot").toLowerCase();
    if (status === "member") {
      await ctx.telegram
        .sendMessage(
          chat.id,
          [
            "Sentry is in this group.",
            "",
            groupVisibilityHint(username),
            "",
            "Employer: enable this group in the Sentry dashboard to turn on community mode.",
          ].join("\n"),
        )
        .catch(() => undefined);
    } else {
      await ctx.telegram
        .sendMessage(
          chat.id,
          "Sentry is an admin here — I can read chats and help with full agent capabilities once the employer enables this group.",
        )
        .catch(() => undefined);
    }

    logEvent("Bot Joined Group", { telegramId, status });
  });

  bot.on("new_chat_members", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const telegramId = chatIdOf(ctx);
    if (!telegramId) return;

    const me = await ctx.telegram.getMe();
    const newcomers = ctx.message.new_chat_members ?? [];

    for (const member of newcomers) {
      if (member.id === me.id) {
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat!.id).catch(() => []);
        await groupService.upsertFromTelegram({
          telegramId,
          name: "title" in ctx.chat! ? ctx.chat.title : null,
          adminTelegramIds: admins.map((a) => String(a.user.id)),
        });
        const username = (me.username ?? "tgemployee_bot").toLowerCase();
        await ctx
          .reply(
            [
              "Sentry joined.",
              groupVisibilityHint(username),
              "Enable the group from the dashboard to activate community mode.",
            ].join("\n"),
          )
          .catch(() => undefined);
        continue;
      }

      const runtime = await resolveGroupRuntime(telegramId);
      if (!runtime?.communityMode || !runtime.billable) continue;
      if (!runtime.group.settings?.welcomeMembers) continue;

      const context = await contextService.build(runtime.group.id);
      const name = member.username ? `@${member.username}` : member.first_name;
      try {
        const welcome = await aiService.generateWelcome({
          context,
          memberName: name,
        });
        await ctx.reply(welcome);
        await recordBillable(runtime, "welcome", { member: name });
      } catch (err) {
        console.error("[welcome]", err);
        await ctx.reply(`Welcome ${name} — glad you're here.`).catch(() => undefined);
      }
    }
  });

  bot.on("text", async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return;
    const text = ctx.message.text;

    // Personal agent (DM)
    if (isPrivateChat(ctx)) {
      await handlePrivateAgent(ctx, text);
      return;
    }

    if (!isGroupChat(ctx)) return;
    const telegramId = chatIdOf(ctx);
    if (!telegramId) return;

    const groupRecord = await groupService.upsertFromTelegram({
      telegramId,
      name: "title" in ctx.chat! ? ctx.chat.title : null,
    });

    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    const fromUsername = ctx.from?.username ?? ctx.from?.first_name ?? null;
    const runtime = await resolveGroupRuntime(telegramId);
    const me = await ctx.telegram.getMe();
    const username = (me.username ?? "").toLowerCase();
    const addressed = messageAddressesBot(ctx.message, {
      botId: me.id,
      username,
    });
    const fromAdmin = isAdminSender(runtime?.adminTelegramIds ?? [], fromUserId);

    // Track chats in community mode, or always track admin↔Sentry interactions.
    // Note: Telegram only delivers non-mention group messages if the bot is admin
    // or BotFather privacy mode is disabled (can_read_all_group_messages).
    const shouldTrack =
      Boolean(runtime?.communityMode) ||
      (fromAdmin && addressed) ||
      Boolean(runtime?.group.settings?.enabled);

    if (shouldTrack) {
      await contextService.appendMessage({
        groupId: groupRecord.id,
        telegramMessageId: String(ctx.message.message_id),
        fromUserId,
        fromUsername,
        text,
      });
    }

    if (!runtime) {
      if (addressed) {
        await replyTo(
          ctx,
          "I'm here, but this group isn't linked yet. Enable it from the Sentry dashboard Groups page.\n\n" +
            capabilitiesSummary(username) +
            "\n\n" +
            groupVisibilityHint(username),
          ctx.message.message_id,
        ).catch(() => undefined);
      }
      return;
    }

    // Employer mention notifications (community mode)
    if (runtime.communityMode && runtime.billable) {
      await notificationService
        .handlePossibleMention({
          groupId: runtime.group.id,
          text,
          fromUsername,
        })
        .catch((err) => console.error("[mention-notify]", err));
    }

    const moderated = await handleModeration(
      ctx,
      runtime,
      text,
      fromUserId,
      fromUsername,
    );
    if (moderated) return;

    await handleGroupIntelligence(
      ctx,
      runtime,
      text,
      fromUserId,
      fromUsername,
      addressed,
    );
  });
}
