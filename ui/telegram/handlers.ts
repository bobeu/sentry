import type { Telegraf, Context } from "telegraf";
import type { Prisma } from "@/generated/client";
import { groupService } from "@/services/group.service";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { actionService } from "@/services/action.service";
import { moderationService } from "@/services/moderation.service";
import { moderationAgent } from "@/services/moderation-agent.service";
import { generateEmployerAnswer } from "@/services/moderation-agent.service";
import { adminModerationService } from "@/services/admin-moderation.service";
import { notificationService } from "@/services/notification.service";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { billingService } from "@/services/billing.service";
import { UNCERTAIN_REPLY } from "@/lib/messages";
import {
  GRATITUDE_ACK,
  casualGreetingReply,
  isCasualGreeting,
  isGratitudeOnly,
  splitTelegramMessage,
  toTelegramHtml,
} from "@/lib/telegram-message";
import {
  engagementService,
  detectEngagementIntent,
  wantsCreateActivity,
  isEngagementQuery,
  isActivityMenuRequest,
  type ActivityType,
} from "@/services/engagement.service";
import {
  rewardService,
  extractWalletAddress,
  isRewardWithdrawRequest,
} from "@/services/reward.service";
import {
  detectEmployerIntent,
  employerAgentService,
} from "@/services/employer-agent.service";
import { employerDmService } from "@/services/employer-dm.service";
import { playbookService } from "@/services/playbook.service";
import {
  escalationService,
  shouldEscalate,
} from "@/services/escalation.service";
import { intentService } from "@/services/intent.service";
import { incidentService } from "@/services/incident.service";
import { memoryService } from "@/services/memory.service";
import { secretaryService } from "@/services/secretary.service";
import {
  askbotService,
  isAskBotAuthorized,
  isAskBotCheckRequest,
} from "@/services/askbot.service";
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

function appBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://sentry-sigma-two.vercel.app";
  return raw.replace(/\/$/, "");
}

function hireDeepLink(groupTelegramId?: string) {
  const base = `${appBaseUrl()}/employment?hire=1`;
  return groupTelegramId
    ? `${base}&group=${encodeURIComponent(groupTelegramId)}`
    : base;
}

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
  extra?: { reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } },
) {
  const chunks = splitTelegramMessage(text);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    const html = toTelegramHtml(chunks[i]);
    const isLast = i === chunks.length - 1;
    const opts: {
      parse_mode: "HTML";
      reply_parameters?: { message_id: number };
      reply_markup?: typeof extra extends undefined ? never : NonNullable<typeof extra>["reply_markup"];
    } = { parse_mode: "HTML" };
    try {
      if (i === 0 && replyToMessageId != null && ctx.chat) {
        opts.reply_parameters = { message_id: replyToMessageId };
      }
      if (isLast && extra?.reply_markup) {
        opts.reply_markup = extra.reply_markup;
      }
      await ctx.reply(html, opts);
    } catch (err) {
      console.warn("[telegram:reply]", err);
      await ctx.reply(chunks[i], isLast && extra?.reply_markup ? { reply_markup: extra.reply_markup } : undefined).catch(() => undefined);
    }
  }
}

async function replyPlain(
  ctx: Context,
  text: string,
  extra?: { reply_markup?: ReturnType<typeof employerDmService.mainMenuKeyboard> },
) {
  const chunks = splitTelegramMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    const html = toTelegramHtml(chunks[i]);
    const isLast = i === chunks.length - 1;
    try {
      await ctx.reply(html, {
        parse_mode: "HTML",
        ...(isLast && extra?.reply_markup
          ? { reply_markup: extra.reply_markup }
          : {}),
      });
    } catch (err) {
      console.warn("[telegram:replyPlain]", err);
      await ctx
        .reply(
          chunks[i],
          isLast && extra?.reply_markup
            ? { reply_markup: extra.reply_markup }
            : undefined,
        )
        .catch(() => undefined);
    }
  }
}

async function handleModeration(
  ctx: Context,
  runtime: GroupRuntime,
  text: string,
  fromUserId: string | null,
  fromUsername: string | null,
  opts?: { hasMedia?: boolean },
) {
  if (!runtime.communityMode || !runtime.group.settings?.spamModeration) return false;
  if (!runtime.billable || !runtime.employerUserId) return false;

  const spamGuidelines = runtime.group.settings.spamGuidelines ?? null;
  const heuristic = moderationService.inspect({
    text,
    fromUserId,
    groupId: runtime.group.id,
    spamGuidelines,
    hasMedia: opts?.hasMedia,
  });

  const priorWarnCount = fromUserId
    ? moderationService.warnCount(runtime.group.id, fromUserId)
    : 0;

  const decision = await moderationAgent.decide({
    text,
    groupName: runtime.group.name ?? runtime.group.telegramId,
    groupRules: runtime.group.rules,
    spamGuidelines,
    fromUsername,
    hasMedia: opts?.hasMedia,
    priorWarnCount,
    heuristic,
  });

  if (decision.action === "ignore") return false;

  const telegramId = chatIdOf(ctx) ?? runtime.group.telegramId;
  let actionTaken: "warn" | "delete" | "mute" | "ban" = "warn";
  const settings = runtime.group.settings;
  const canAdmin =
    settings?.adminModeration !== false && Boolean(fromUserId);

  if (decision.action === "warn") {
    if (fromUserId) moderationService.noteWarning(runtime.group.id, fromUserId);
    await ctx
      .reply(
        toTelegramHtml(
          `Heads up — this looks off (**${decision.reason}**). Please keep the chat on-topic and constructive.`,
        ),
        { parse_mode: "HTML" },
      )
      .catch(() => undefined);
    actionTaken = "warn";
  } else if (
    decision.action === "delete" ||
    decision.action === "mute" ||
    decision.action === "ban"
  ) {
    let deleted = false;
    try {
      if (ctx.message && "message_id" in ctx.message) {
        await ctx.deleteMessage(ctx.message.message_id);
        deleted = true;
      }
    } catch {
      // missing delete permission
    }
    if (deleted) actionTaken = "delete";

    if (canAdmin && fromUserId && (decision.action === "mute" || decision.action === "ban")) {
      try {
        await adminModerationService.execute({
          groupId: runtime.group.id,
          telegramChatId: telegramId,
          employerUserId: runtime.employerUserId,
          billable: false,
          action: decision.action,
          targetUserId: fromUserId,
          durationSec: decision.action === "mute" ? 3600 : undefined,
          reason: decision.reason,
          roseRelayEnabled: Boolean(settings?.roseRelayEnabled),
          roseBotUsername: settings?.roseBotUsername,
        });
        actionTaken = decision.action;
      } catch (err) {
        console.warn("[moderation:restrict]", err);
      }
    }

    await ctx
      .reply(
        toTelegramHtml(
          actionTaken === "ban"
            ? `Removed spam and **banned** the sender (${decision.reason}).`
            : actionTaken === "mute"
              ? `Removed spam and **muted** the sender for 1h (${decision.reason}).`
              : deleted
                ? `Removed a spam message (**${decision.reason}**).`
                : `Flagged spam (**${decision.reason}**), but I need delete/restrict permission as admin.`,
        ),
        { parse_mode: "HTML" },
      )
      .catch(() => undefined);
  }

  for (const adminId of runtime.adminTelegramIds.slice(0, 5)) {
    await ctx.telegram
      .sendMessage(
        Number(adminId),
        toTelegramHtml(
          `Sentry moderation in **${runtime.group.name ?? telegramId}**: ${actionTaken} (${decision.reason}, ${(decision.confidence * 100).toFixed(0)}%) from ${fromUsername ?? fromUserId}\n\n${text.slice(0, 400)}`,
        ),
        { parse_mode: "HTML" },
      )
      .catch(() => undefined);
  }

  await recordBillable(runtime, "spam_moderation", {
    reason: decision.reason,
    confidence: decision.confidence,
    actionTaken,
    heuristicSpam: heuristic.spam,
    matchedGuideline: heuristic.matchedGuideline ?? null,
    hasMedia: Boolean(opts?.hasMedia),
  });
  return true;
}

async function agentAnswerForGroup(
  runtime: GroupRuntime,
  cleaned: string,
  fromUsername: string | null,
  fromUserId: string | null,
) {
  const context = await contextService.build(runtime.group.id);
  const playbookRules =
    runtime.employerUserId && runtime.group.settings?.livingPlaybook !== false
      ? await playbookService.formatForPrompt(
          runtime.employerUserId,
          runtime.group.id,
        )
      : "";
  const memberNote = await memoryService.getNote(runtime.group.id, fromUserId);
  const engagementContext = rewardService.formatEngagementContext(
    runtime.group.settings,
  );
  const activeSummary = await engagementService.summarizeActiveForGroup(
    runtime.group.id,
  );
  return aiService.generateReply({
    context,
    userQuestion: cleaned,
    userName: fromUsername ?? undefined,
    preferFaq: false,
    groupId: runtime.group.id,
    playbookRules: playbookRules || undefined,
    personaRole: runtime.group.settings?.personaRole,
    personaTone: runtime.group.settings?.personaTone,
    humorEnabled: runtime.group.settings?.humorEnabled,
    humorStyle: runtime.group.settings?.humorStyle,
    memberNote,
    engagementContext: `${engagementContext}\n\nActive activities:\n${activeSummary}`,
  });
}

/**
 * Engagement / rewards path: withdraw, social proof, start activity.
 * Returns true when the message was fully handled.
 */
async function handleEngagementAndRewards(
  ctx: Context,
  runtime: GroupRuntime,
  text: string,
  cleaned: string,
  fromUserId: string | null,
  fromUsername: string | null,
  addressed: boolean,
  fromAdmin: boolean,
): Promise<boolean> {
  const message = ctx.message && "message_id" in ctx.message ? ctx.message : null;
  if (!message || !fromUserId) return false;
  if (!runtime.communityMode) return false;

  const settings = runtime.group.settings;

  // Member withdraw / claim reward (wallet in message + tag Sentry, or withdraw keywords).
  const wallet = extractWalletAddress(cleaned);
  if (
    addressed &&
    (isRewardWithdrawRequest(cleaned) || (wallet && /\b(reward|points|withdraw|claim|payout)\b/i.test(cleaned)))
  ) {
    if (wallet) {
      await rewardService.setPayoutAddress(
        runtime.group.id,
        fromUserId,
        wallet,
        fromUsername,
      );
    }
    const result = await rewardService.tryPayoutMember({
      groupId: runtime.group.id,
      telegramUserId: fromUserId,
      destination: wallet ?? undefined,
    });
    await replyTo(ctx, result.message, message.message_id);
    if (result.ok && runtime.billable) {
      await recordBillable(runtime, "reward_payout", {
        amount: result.amount,
        currency: result.currency,
      });
    }
    return true;
  }

  // Social campaign proof (URL) when tagging Sentry or replying under an active campaign.
  const url = engagementService.extractUrl(cleaned);
  if (url && (addressed || TWITTERISH.test(url))) {
    const social = await engagementService.findOpenSocial(runtime.group.id);
    if (social && settings?.allowSocialCampaigns) {
      const verified = await engagementService.verifySocialSubmission({
        activityId: social.id,
        telegramUserId: fromUserId,
        username: fromUsername,
        text: cleaned,
      });
      if (addressed || verified.ok) {
        await replyTo(ctx, verified.message, message.message_id);
        if (verified.ok && runtime.billable) {
          await recordBillable(runtime, "points_award", {
            kind: "social",
            points: verified.points,
          });
        }
        return true;
      }
    }
  }

  // Activity status / "what's available" — answer, never auto-create.
  if (addressed && (isEngagementQuery(cleaned) || isActivityMenuRequest(cleaned))) {
    const enabled = engagementService.enabledActivityTypes(settings);
    const active = await engagementService.summarizeActiveForGroup(runtime.group.id);
    const lines = [
      enabled.length
        ? `Here's what's enabled here:\n${enabled.map((e) => `• **${e.label}** — ${e.blurb}`).join("\n")}`
        : "No engagement activities are enabled yet — ask the employer to flip them on in the dashboard.",
      "",
      `Live right now:\n${active}`,
      enabled.length ? "\nTap a button (or say e.g. `start quiz` / `create poll`) and I'll spin one up." : "",
    ];
    await replyTo(ctx, lines.filter(Boolean).join("\n"), message.message_id, {
      reply_markup: enabled.length
        ? engagementService.activityMenuKeyboard(enabled)
        : undefined,
    });
    return true;
  }

  // Open-text quiz / fun answers — only short answer-shaped replies (don't steal Q&A).
  const looksLikeOpenAnswer =
    addressed &&
    cleaned.length > 0 &&
    cleaned.length <= 120 &&
    !/\?/.test(cleaned) &&
    !wantsCreateActivity(cleaned) &&
    !isEngagementQuery(cleaned) &&
    !isActivityMenuRequest(cleaned) &&
    !/\b(my\s+points|leaderboard|withdraw|reward|help|what|how|why|when)\b/i.test(
      cleaned,
    );
  if (looksLikeOpenAnswer) {
    const openResult = await engagementService.handleOpenTextAnswer({
      groupId: runtime.group.id,
      telegramUserId: fromUserId,
      username: fromUsername,
      text: cleaned,
    });
    if (openResult) {
      if (openResult.duplicate) {
        await replyTo(ctx, "You already played this one — wait for the next round!", message.message_id);
      } else if (openResult.verified && openResult.points > 0) {
        await replyTo(
          ctx,
          `Nailed it — +${openResult.points} points. You're on a roll!`,
          message.message_id,
        );
        if (runtime.billable) {
          await recordBillable(runtime, "points_award", {
            kind: "open",
            points: openResult.points,
          });
        }
      } else {
        await replyTo(
          ctx,
          "Not quite — hang in there for the next round (or ask what's active).",
          message.message_id,
        );
      }
      return true;
    }
  }

  // Start activity ONLY on explicit create/start intent (never on "when does the poll end?").
  if (addressed && wantsCreateActivity(cleaned)) {
    const type: ActivityType = detectEngagementIntent(cleaned) ?? "fun";
    if (!engagementService.typeAllowed(type, settings)) {
      await replyTo(
        ctx,
        `That activity type isn't enabled here. An employer can turn it on under Capabilities → Engagement.`,
        message.message_id,
      );
      return true;
    }

    // Social campaign: employer/admin posts URL + start command.
    if (type === "social") {
      if (!fromAdmin && !runtime.employerUserId) {
        await replyTo(
          ctx,
          "Only admins can launch social campaigns. Paste the post link and ask an admin to start it with me.",
          message.message_id,
        );
        return true;
      }
      const target = url ?? engagementService.extractUrl(text);
      if (!target) {
        await replyTo(
          ctx,
          "Share the Twitter/X post URL and say e.g. `start social retweet` tagging me.",
          message.message_id,
        );
        return true;
      }
      const action = /\blike\b/i.test(cleaned)
        ? "like"
        : /\bfollow\b/i.test(cleaned)
          ? "follow"
          : "retweet";
      try {
        const activity = await engagementService.createSocialCampaign({
          groupId: runtime.group.id,
          targetUrl: target,
          action,
          createdByUserId: runtime.employerUserId,
        });
        await replyTo(
          ctx,
          engagementService.formatActivityBrief(activity, settings),
          message.message_id,
        );
        if (runtime.billable) {
          await recordBillable(runtime, "engagement_activity", {
            type: "social",
            activityId: activity.id,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not start campaign";
        await replyTo(ctx, msg, message.message_id);
      }
      return true;
    }

    try {
      const context = await contextService.build(runtime.group.id);
      const activity = await engagementService.inventActivity({
        groupId: runtime.group.id,
        type,
        context,
        guidelines: settings?.engagementGuidelines,
        createdByUserId: runtime.employerUserId,
        hint: cleaned,
      });
      if (type === "poll" || type === "learn" || type === "game") {
        await engagementService.postTelegramPoll(ctx, activity, settings);
      } else {
        await replyTo(
          ctx,
          engagementService.formatActivityBrief(activity, settings),
          message.message_id,
        );
      }
      if (runtime.billable) {
        await recordBillable(runtime, "engagement_activity", {
          type,
          activityId: activity.id,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start activity";
      await replyTo(ctx, msg, message.message_id);
    }
    return true;
  }

  // Points / leaderboard quick ask
  if (addressed && /\b(my\s+points|leaderboard|top\s+points|scoreboard)\b/i.test(cleaned)) {
    if (/\bleaderboard|top\s+points|scoreboard\b/i.test(cleaned)) {
      const top = await rewardService.leaderboard(runtime.group.id, 8);
      const lines = top.map(
        (m, i) =>
          `${i + 1}. ${m.username ? `@${m.username}` : m.telegramUserId} — ${m.points} pts`,
      );
      await replyTo(
        ctx,
        lines.length ? `Leaderboard:\n${lines.join("\n")}` : "No points yet — join the next activity!",
        message.message_id,
      );
    } else {
      const mine = await rewardService.getOrCreateMemberPoints({
        groupId: runtime.group.id,
        telegramUserId: fromUserId,
        username: fromUsername,
      });
      await replyTo(
        ctx,
        `You have **${mine.points}** points (lifetime ${mine.lifetimePoints}). Pending cash: ${mine.pendingReward.toString()}.`,
        message.message_id,
      );
    }
    return true;
  }

  return false;
}

const TWITTERISH = /(?:twitter\.com|x\.com)\//i;

async function deliverOrEscalate(input: {
  ctx: Context;
  runtime: GroupRuntime;
  cleaned: string;
  result: { text: string; viaFaq: boolean };
  messageId: number;
  fromAdmin: boolean;
  proactive?: boolean;
}) {
  const { ctx, runtime, cleaned, result, messageId, fromAdmin, proactive } =
    input;
  const settings = runtime.group.settings;
  const escalate =
    Boolean(settings?.escalationLadder) &&
    runtime.billable &&
    runtime.employerUserId &&
    shouldEscalate(cleaned, result.viaFaq);

  if (escalate && runtime.employerUserId) {
    await escalationService.createAndNotify({
      groupId: runtime.group.id,
      userId: runtime.employerUserId,
      draftText: result.text,
      reason: "Ambiguous or high-stakes — needs employer approval",
      sourceTelegramMsgId: String(messageId),
      sourceChatId: chatIdOf(ctx) ?? runtime.group.telegramId,
      groupName: runtime.group.name,
    });
    await replyTo(
      ctx,
      "I've drafted a reply and sent it to the employer for approval — they'll post it shortly.",
      messageId,
    );
    return;
  }

  await replyTo(ctx, result.text, messageId);
  await recordBillable(runtime, result.viaFaq ? "faq_answer" : "mention_reply", {
    viaFaq: result.viaFaq,
    fromAdmin,
    proactive: Boolean(proactive),
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

  // Gratitude-only: acknowledge without re-answering the previous question.
  if (isGratitudeOnly(cleaned)) {
    if (addressed || runtime.communityMode) {
      await replyTo(ctx, GRATITUDE_ACK, message.message_id);
      await recordBillable(runtime, "mention_reply", { kind: "gratitude" }, false);
    }
    return;
  }

  // Casual hi/hey — short lively reply only (never dump FAQs or capability walls).
  if (addressed && isCasualGreeting(cleaned)) {
    const funHint =
      runtime.group.settings?.allowFun || runtime.group.settings?.allowGames
        ? "Want a quick poll, trivia, or learn-and-earn round? Just say the word."
        : null;
    await replyTo(
      ctx,
      casualGreetingReply(
        fromUsername ? `@${fromUsername.replace(/^@/, "")}` : null,
        funHint,
      ),
      message.message_id,
    );
    await recordBillable(runtime, "mention_reply", { kind: "greeting" }, false);
    // Soft cadence offer (non-blocking).
    void engagementService
      .maybeOfferFun({
        groupId: runtime.group.id,
        send: (t) => replyTo(ctx, t, message.message_id),
      })
      .catch(() => undefined);
    return;
  }

  // Engagement / rewards before general Q&A — prevents dumping FAQs into activity flows.
  const engagementHandled = await handleEngagementAndRewards(
    ctx,
    runtime,
    text,
    cleaned,
    fromUserId,
    fromUsername,
    addressed,
    fromAdmin,
  );
  if (engagementHandled) return;

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
      const hire =
        runtime.group.settings?.hireInTelegram !== false
          ? `\n\nHire Sentry for this community:\n${hireDeepLink(runtime.group.telegramId)}`
          : "";
      await replyTo(
        ctx,
        "This group hasn't fully activated community mode yet. An employer can enable Sentry from the dashboard Groups page.\n\n" +
          capabilitiesSummary(username) +
          hire,
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
      const result = await agentAnswerForGroup(
        runtime,
        cleaned,
        fromUsername,
        fromUserId,
      );
      await deliverOrEscalate({
        ctx,
        runtime,
        cleaned,
        result,
        messageId: message.message_id,
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
    // Always route through the agent so FAQ + knowledge-base tools can narrow the reply.
    const result = await agentAnswerForGroup(
      runtime,
      cleaned,
      fromUsername,
      fromUserId,
    );
    await deliverOrEscalate({
      ctx,
      runtime,
      cleaned,
      result,
      messageId: message.message_id,
      fromAdmin,
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
  const displayName = ctx.from?.username ?? ctx.from?.first_name ?? undefined;

  // Slash commands are handled exclusively by registerCommands (menus stay DM-scoped there).
  if (text.trim().startsWith("/")) {
    return;
  }

  const cleanedEarly = stripBotMention(text, username) || text;

  // AskBot matched-review check — ONLY Telegram user 805099765.
  // Points Sentry at .agents/askbot/SKILL.md and runs the earn cycle.
  if (isAskBotAuthorized(fromUserId) && isAskBotCheckRequest(cleanedEarly)) {
    await replyPlain(
      ctx,
      `Checking AskBot matches (skill: ${askbotService.skillPath()})…`,
    );
    try {
      const report = await askbotService.runEarnCycle({ maxProjects: 2 });
      await replyPlain(ctx, report);
    } catch (err) {
      await replyPlain(
        ctx,
        `AskBot cycle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return;
  }

  if (!linked?.user) {
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        "Personal mode: sign in on the dashboard and link your Telegram user ID under Settings, then hire & fund Sentry.",
        "Tip: type / for commands, or /menu after linking.",
      ].join("\n"),
      { reply_markup: employerDmService.mainMenuKeyboard() },
    );
    return;
  }

  const user = linked.user;
  const active = user.employment?.status === "Active";
  const cleaned = stripBotMention(text, username) || text;

  if (isGratitudeOnly(cleaned)) {
    await replyPlain(ctx, GRATITUDE_ACK, {
      reply_markup: employerDmService.mainMenuKeyboard(),
    });
    return;
  }

  const intent = detectEmployerIntent(cleaned);

  if (intent === "engagement" || intent === "rewards") {
    const engagementHandled =
      await employerAgentService.tryHandleEngagementCommand(user.id, cleaned);
    if (engagementHandled) {
      await replyPlain(ctx, engagementHandled, {
        reply_markup: employerDmService.mainMenuKeyboard(),
      });
      return;
    }
  }

  if (intent === "rewards") {
    const handled = await employerAgentService.tryHandleRewardCommand(
      user.id,
      cleaned,
    );
    if (handled) {
      await replyPlain(ctx, handled, {
        reply_markup: employerDmService.mainMenuKeyboard(),
      });
      return;
    }
  }

  const groupPick = cleaned.match(
    /^(?:open|select|group|use)\s+(?:group\s+)?(?:#?(\d+)|(.+))$/i,
  );
  if (groupPick && active) {
    const groups = await groupService.listForUser(user.id);
    const byIndex = groupPick[1] ? groups[Number(groupPick[1]) - 1] : null;
    const needle = (groupPick[2] ?? "").trim().toLowerCase();
    const byName = needle
      ? groups.find(
          (g) =>
            (g.name ?? "").toLowerCase().includes(needle) ||
            g.telegramId.includes(needle),
        )
      : null;
    const picked = byIndex ?? byName;
    if (picked) {
      const card = await employerAgentService.formatGroupCard(user.id, picked.id);
      await replyPlain(ctx, card, {
        reply_markup: employerDmService.mainMenuKeyboard(),
      });
      return;
    }
  }

  if (intent === "help" || shouldOfferHelpOnly(text, username)) {
    await employerDmService.sendWelcome(fromUserId!, user.id, displayName);
    return;
  }

  if (!active || !user.wallet) {
    await ctx.reply(
      "Your account is linked, but Sentry isn't actively employed yet. Hire and fund the employment wallet in the dashboard, then ask again.",
      { reply_markup: employerDmService.mainMenuKeyboard() },
    );
    return;
  }

  const learned = await playbookService.learnFromCorrection({
    userId: user.id,
    text: cleaned,
  });
  if (learned) {
    await ctx.reply(
      `Playbook updated.\nWhen "${learned.trigger}": ${learned.instruction}`,
      { reply_markup: employerDmService.mainMenuKeyboard() },
    );
    return;
  }

  const secMatch = cleaned.match(/^sec\s*:\s*(.+)$/is);
  if (secMatch) {
    const conn = await prisma.businessConnectionRecord.findFirst({
      where: { userTelegramId: fromUserId ?? "", isEnabled: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!conn) {
      await ctx.reply("No active Secretary Mode connection.");
      return;
    }
    try {
      await secretaryService.sendAsUser({
        connectionId: conn.connectionId,
        userTelegramId: fromUserId!,
        text: secMatch[1].trim(),
      });
      await ctx.reply("Sent as you via Secretary Mode.");
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Could not send.");
    }
    return;
  }

  const editMatch = cleaned.match(/^edit\s*:\s*(.+)$/is);
  if (editMatch) {
    const pending = await escalationService.listPending(user.id);
    const esc = pending[0];
    if (esc) {
      await escalationService.resolve(esc.id, user.id, "edited", editMatch[1].trim());
      await ctx.reply("Edited draft posted to the group.");
      return;
    }
  }

  try {
    const ledger = await billingService.getBalanceLedger(user.id);
    if (ledger.availableBalance <= 0) {
      await ctx.reply(
        "I'm ready, but your employment wallet has no available balance. Deposit funds, then ask me anything.",
        { reply_markup: employerDmService.mainMenuKeyboard() },
      );
      return;
    }

    if (
      intent === "status" ||
      intent === "work" ||
      intent === "report" ||
      intent === "spam" ||
      intent === "agreement" ||
      intent === "employment" ||
      intent === "rewards"
    ) {
      const report = await employerAgentService.formatDirectReport(user.id, intent);
      await replyPlain(ctx, report, {
        reply_markup: employerDmService.mainMenuKeyboard(),
      });
      await actionService.record({
        type: "mention_reply",
        userId: user.id,
        billable: true,
        metadata: { channel: "private", intent, report: true },
      });
      return;
    }

    const brief = await employerAgentService.buildOperationalBrief(user.id, intent);
    const textOut = await generateEmployerAnswer({
      question: cleaned,
      displayName,
      operationalBrief: brief,
    });
    await replyPlain(ctx, textOut, {
      reply_markup: employerDmService.mainMenuKeyboard(),
    });
    await actionService.record({
      type: "mention_reply",
      userId: user.id,
      billable: true,
      metadata: { channel: "private", intent, employerAnswer: true },
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

  bot.on("callback_query", async (ctx) => {
    const data =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : null;
    if (!data) return;
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;

    if (data.startsWith("sec:")) {
      const parts = data.split(":");
      const decision = parts[1];
      const connectionId = parts[2];
      if (!fromUserId || !connectionId) {
        await ctx.answerCbQuery("Invalid").catch(() => undefined);
        return;
      }
      if (decision === "ok") {
        const ok = await secretaryService.approvePending(connectionId, fromUserId);
        await ctx.answerCbQuery(ok ? "Sent" : "Nothing pending").catch(() => undefined);
        await ctx
          .editMessageReplyMarkup({ inline_keyboard: [] })
          .catch(() => undefined);
        await ctx.reply(ok ? "Draft sent as you." : "No pending draft.").catch(() => undefined);
      } else {
        await ctx.answerCbQuery("Ignored").catch(() => undefined);
        await ctx
          .editMessageReplyMarkup({ inline_keyboard: [] })
          .catch(() => undefined);
      }
      return;
    }

    if (data.startsWith("emp:")) {
      const linkedEmp = await findLinkedUserByTelegram(fromUserId);
      if (!linkedEmp?.user) {
        await ctx.answerCbQuery("Link your Telegram ID in Settings first.").catch(() => undefined);
        return;
      }
      const handled = await employerDmService.handleCallback({
        data,
        userId: linkedEmp.user.id,
        telegramUserId: fromUserId!,
        answerCb: (t) => ctx.answerCbQuery(t).catch(() => undefined),
        editOrReply: async (msg, keyboard) => {
          try {
            await ctx.editMessageText(msg.slice(0, 3900), {
              reply_markup: keyboard,
            });
          } catch {
            await ctx.reply(msg.slice(0, 3900), {
              reply_markup: keyboard ?? employerDmService.mainMenuKeyboard(),
            });
          }
        },
      });
      if (handled) return;
    }

    // Group activity picker: act:poll | act:learn | act:game | act:fun | act:comic
    if (data.startsWith("act:")) {
      const type = data.slice(4) as ActivityType;
      const chatId = chatIdOf(ctx);
      if (!chatId || !fromUserId) {
        await ctx.answerCbQuery("Can't start here").catch(() => undefined);
        return;
      }
      const runtime = await resolveGroupRuntime(chatId);
      if (!runtime?.communityMode) {
        await ctx.answerCbQuery("Community mode off").catch(() => undefined);
        return;
      }
      if (!engagementService.typeAllowed(type, runtime.group.settings)) {
        await ctx.answerCbQuery("Not enabled").catch(() => undefined);
        return;
      }
      if (type === "social") {
        await ctx.answerCbQuery("Paste a post URL + start social").catch(() => undefined);
        await ctx.reply("For social campaigns, paste the Twitter/X link and say `start social` tagging me.").catch(() => undefined);
        return;
      }
      try {
        await ctx.answerCbQuery(`Starting ${type}…`).catch(() => undefined);
        const context = await contextService.build(runtime.group.id);
        const activity = await engagementService.inventActivity({
          groupId: runtime.group.id,
          type,
          context,
          guidelines: runtime.group.settings?.engagementGuidelines,
          createdByUserId: runtime.employerUserId,
          hint: `member picked ${type} from menu`,
        });
        if (type === "poll" || type === "learn" || type === "game") {
          await engagementService.postTelegramPoll(ctx, activity, runtime.group.settings);
        } else {
          await ctx.reply(
            engagementService.formatActivityBrief(activity, runtime.group.settings),
          );
        }
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
        if (runtime.billable) {
          await recordBillable(runtime, "engagement_activity", {
            type,
            activityId: activity.id,
            via: "inline",
          });
        }
      } catch (err) {
        await ctx
          .reply(err instanceof Error ? err.message : "Could not start activity.")
          .catch(() => undefined);
      }
      return;
    }

    if (!data.startsWith("esc:")) return;
    const linked = await findLinkedUserByTelegram(fromUserId);
    if (!linked?.user) {
      await ctx.answerCbQuery("Link your Telegram ID in Settings first.").catch(() => undefined);
      return;
    }
    const [, decision, id] = data.split(":");
    if (!id || (decision !== "ok" && decision !== "no")) {
      await ctx.answerCbQuery("Unknown action").catch(() => undefined);
      return;
    }
    const resolved = await escalationService.resolve(
      id,
      linked.user.id,
      decision === "ok" ? "approved" : "ignored",
    );
    if (!resolved) {
      await ctx.answerCbQuery("Already resolved or not found").catch(() => undefined);
      return;
    }
    await ctx.answerCbQuery(decision === "ok" ? "Approved" : "Ignored").catch(() => undefined);
    await ctx
      .editMessageReplyMarkup({ inline_keyboard: [] })
      .catch(() => undefined);
    await ctx.reply(decision === "ok" ? "Posted to the group." : "Ignored.").catch(() => undefined);
  });

  // Secretary Mode (Telegram Business connection)
  bot.on("business_connection" as "message", async (ctx) => {
    const update = ctx.update as {
      business_connection?: {
        id: string;
        user: { id: number; username?: string; first_name?: string };
        user_chat_id: number;
        is_enabled: boolean;
        rights?: { can_reply?: boolean } | null;
      };
    };
    const conn = update.business_connection;
    if (!conn) return;
    try {
      await secretaryService.upsertConnection(conn);
      const bot = ctx.telegram;
      await bot
        .sendMessage(
          conn.user_chat_id,
          conn.is_enabled
            ? "Secretary Mode connected. I'll auto-reply to simple/FAQ messages and escalate the rest to you here."
            : "Secretary Mode disconnected.",
        )
        .catch(() => undefined);
    } catch (err) {
      console.error("[secretary:connection]", err);
    }
  });

  bot.on("business_message" as "message", async (ctx) => {
    const update = ctx.update as {
      business_message?: {
        message_id: number;
        chat: { id: number };
        text?: string;
        from?: { id: number; username?: string; first_name?: string };
        business_connection_id?: string;
      };
    };
    const msg = update.business_message;
    if (!msg) return;
    try {
      await secretaryService.handleBusinessMessage(msg);
    } catch (err) {
      console.error("[secretary:message]", err);
    }
  });

  bot.use(async (ctx, next) => {
    const update = ctx.update as {
      managed_bot?: { bot?: { id?: number; username?: string } };
    };
    if (update.managed_bot) {
      console.info("[managed_bot]", update.managed_bot.bot?.username ?? update.managed_bot);
    }
    return next();
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
    const canRestrict =
      meAdmin?.status === "creator" ||
      (meAdmin?.status === "administrator" &&
        "can_restrict_members" in meAdmin &&
        Boolean(meAdmin.can_restrict_members));
    const canBan = canRestrict;

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
        botCanRestrict: Boolean(canRestrict),
        botCanBan: Boolean(canBan),
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
      // Welcome whenever community mode is on and welcome is enabled.
      // Do not require billable — a short welcome should not fail when wallet is low.
      if (!runtime?.communityMode) continue;
      if (!runtime.group.settings?.welcomeMembers) continue;

      const context = await contextService.build(runtime.group.id);
      const name = member.username ? `@${member.username}` : member.first_name;
      try {
        const welcome = await Promise.race([
          aiService.generateWelcome({
            context,
            memberName: name,
          }),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("welcome-timeout")), 12_000),
          ),
        ]);
        await ctx.reply(toTelegramHtml(welcome), { parse_mode: "HTML" });
        if (runtime.billable) {
          await recordBillable(runtime, "welcome", { member: name });
        }
      } catch (err) {
        console.error("[welcome]", err);
        const rules = runtime.group.rules?.trim();
        const purpose = runtime.group.purpose?.trim();
        const fallback = [
          `Welcome ${name}!`,
          purpose ? `This group: ${purpose}` : "Glad you're here.",
          rules ? `House rules:\n${rules.slice(0, 800)}` : null,
          "Tag me anytime if you need help — happy to assist.",
        ]
          .filter(Boolean)
          .join("\n\n");
        await ctx.reply(fallback).catch(() => undefined);
        if (runtime.billable) {
          await recordBillable(runtime, "welcome", {
            member: name,
            fallback: true,
          }).catch(() => undefined);
        }
      }
    }
  });

  // Media spam path (photos/videos/docs) — caption + employer image guidelines.
  const mediaHandler = async (ctx: Context) => {
    if (!isGroupChat(ctx) || !ctx.message) return;
    const telegramId = chatIdOf(ctx);
    if (!telegramId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) return;
    const caption =
      "caption" in ctx.message && typeof ctx.message.caption === "string"
        ? ctx.message.caption
        : "";
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    const fromUsername = ctx.from?.username ?? ctx.from?.first_name ?? null;
    await handleModeration(ctx, runtime, caption, fromUserId, fromUsername, {
      hasMedia: true,
    });
  };
  bot.on("photo", mediaHandler);
  bot.on("video", mediaHandler);
  bot.on("animation", mediaHandler);
  bot.on("document", mediaHandler);
  bot.on("sticker", mediaHandler);

  bot.on("poll_answer", async (ctx) => {
    const answer = ctx.pollAnswer;
    if (!answer?.user?.id || !answer.poll_id) return;
    try {
      const result = await engagementService.handlePollAnswer({
        pollId: answer.poll_id,
        telegramUserId: String(answer.user.id),
        username: answer.user.username ?? answer.user.first_name ?? null,
        optionIds: answer.option_ids ?? [],
      });
      if (!result || result.duplicate || !result.points) return;
      // Best-effort DM ack — group reply needs chat id which poll_answer may lack.
      await ctx.telegram
        .sendMessage(
          answer.user.id,
          result.verified
            ? `Nice! +${result.points} points for "${result.activity.title}".`
            : `Thanks for playing "${result.activity.title}".`,
        )
        .catch(() => undefined);
    } catch (err) {
      console.error("[poll_answer]", err);
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
            groupVisibilityHint(username) +
            `\n\nHire me: ${hireDeepLink(telegramId)}`,
          ctx.message.message_id,
        ).catch(() => undefined);
      }
      return;
    }

    // Pre-hooks: incident + intent (after FAQ/capability short-circuits live inside intelligence)
    if (runtime.communityMode) {
      await incidentService
        .maybeTrigger({
          groupId: runtime.group.id,
          telegramChatId: telegramId,
          text,
          fromUsername,
          employerUserId: runtime.employerUserId,
          billable: runtime.billable,
          botCanDelete: runtime.group.botCanDelete,
          adminTelegramIds: runtime.adminTelegramIds,
          groupName: runtime.group.name,
        })
        .catch((err) => console.error("[incident]", err));

      await intentService
        .handle({
          groupId: runtime.group.id,
          userId: runtime.employerUserId,
          text,
          fromUsername,
          groupName: runtime.group.name,
          billable: runtime.billable,
        })
        .catch((err) => console.error("[intent]", err));
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
