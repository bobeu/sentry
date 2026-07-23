import type { Telegraf, Context } from "telegraf";
import { prisma } from "@/lib/prisma";
import { walletService } from "@/services/wallet.service";
import { formatAmount } from "@/lib/payment-currency";
import { billingService } from "@/services/billing.service";
import { memoryService } from "@/services/memory.service";
import {
  adminModerationService,
  parseDurationSeconds,
  resolveTargetUserId,
  type ModerationAction,
} from "@/services/admin-moderation.service";
import { announcementService } from "@/services/announcement.service";
import { birthdayService } from "@/services/birthday.service";
import { employerDmService } from "@/services/employer-dm.service";
import { employerAgentService } from "@/services/employer-agent.service";
import {
  botUsername,
  capabilitiesSummary,
  chatIdOf,
  findLinkedUserByTelegram,
  isAdminSender,
  isGroupChat,
  isPrivateChat,
  resolveGroupRuntime,
} from "@/telegram/runtime";

async function walletMessage(telegramUserId: string) {
  const settings = await prisma.settings.findFirst({
    where: { telegramUserId },
    include: { user: { include: { wallet: true, employment: true } } },
  });
  if (!settings?.user) {
    return "Sign in at the Sentry dashboard and link your Telegram user ID in Settings first.";
  }

  const wallet = settings.user.wallet;
  if (!wallet) {
    return "Hire Sentry in the dashboard to provision your employment wallet.";
  }

  const currency = wallet.walletCurrency as import("@/lib/payment-currency").PaymentCurrency;
  const synced = await walletService.syncBalanceFromChain(settings.user.id);
  const balance = synced?.balance ?? Number(wallet.balance.toString());
  let available = balance;
  try {
    const ledger = await billingService.getBalanceLedger(settings.user.id);
    available = ledger.availableBalance;
  } catch {
    // keep on-chain/cached balance
  }

  return [
    "Your Sentry Employment Wallet",
    "",
    wallet.address,
    "",
    "Accepted Currency",
    currency,
    "",
    "You can either:",
    `• Send ${currency} directly to this address.`,
    "• Visit the dashboard to deposit from a connected wallet.",
    "",
    "Cached balance",
    formatAmount(balance, currency),
    "Available (after outstanding charges)",
    formatAmount(available, currency),
  ].join("\n");
}

function commandArgs(ctx: Context, command: string) {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  return text.replace(new RegExp(`^/${command}(@\\w+)?\\s*`, "i"), "").trim();
}

/** Inline employer menus are DM-only — never attach in groups. */
function dmMenuExtra(ctx: Context) {
  if (!isPrivateChat(ctx)) return undefined;
  return { reply_markup: employerDmService.mainMenuKeyboard() };
}

async function replyDm(ctx: Context, text: string, withMenu = true) {
  const { splitTelegramMessage, toTelegramHtml } = await import(
    "@/lib/telegram-message"
  );
  const chunks = splitTelegramMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    const html = toTelegramHtml(chunks[i]);
    const isLast = i === chunks.length - 1;
    try {
      await ctx.reply(html, {
        parse_mode: "HTML",
        ...(isLast && withMenu ? dmMenuExtra(ctx) : {}),
      });
    } catch {
      await ctx.reply(chunks[i], isLast && withMenu ? dmMenuExtra(ctx) : undefined);
    }
  }
}

async function openEmployerMenu(ctx: Context) {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("Open a private chat with me to use the employer action menu.");
    return;
  }
  const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
  const linked = await findLinkedUserByTelegram(fromUserId);
  const displayName = ctx.from?.username ?? ctx.from?.first_name ?? undefined;
  if (linked?.user && fromUserId) {
    await employerDmService.sendWelcome(fromUserId, linked.user.id, displayName);
    return;
  }
  const username = await botUsername(ctx);
  await replyDm(
    ctx,
    [
      capabilitiesSummary(username),
      "",
      "Sign in on the dashboard and link your Telegram user ID under Settings to unlock the full employer menu.",
      "Tip: type / to see available commands.",
    ].join("\n"),
  );
}

async function runModerationCommand(ctx: Context, action: ModerationAction) {
  if (!isGroupChat(ctx)) {
    await ctx.reply("Use moderation commands in a group.");
    return;
  }
  const telegramId = chatIdOf(ctx);
  const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
  if (!telegramId || !fromUserId) return;

  const runtime = await resolveGroupRuntime(telegramId);
  if (!runtime?.communityMode) {
    await ctx.reply("Community mode isn't enabled for this group.");
    return;
  }
  if (runtime.group.settings?.adminModeration === false) {
    await ctx.reply("Admin moderation is disabled in group settings.");
    return;
  }
  if (!isAdminSender(runtime.adminTelegramIds, fromUserId)) {
    await ctx.reply("Only group admins can use moderation commands.");
    return;
  }

  const raw = commandArgs(ctx, action);
  const parts = raw.split(/\s+/).filter(Boolean);
  const replyFrom =
    ctx.message &&
    "reply_to_message" in ctx.message &&
    ctx.message.reply_to_message?.from?.id
      ? ctx.message.reply_to_message.from.id
      : null;

  let targetArg: string | null = null;
  let durationRaw: string | null = null;
  let reasonParts: string[] = [];

  if (replyFrom != null) {
    if (parts[0] && /^\d+[smhd]?$/i.test(parts[0])) {
      durationRaw = parts[0];
      reasonParts = parts.slice(1);
    } else {
      reasonParts = parts;
    }
  } else {
    targetArg = parts[0] ?? null;
    if (parts[1] && /^\d+[smhd]?$/i.test(parts[1])) {
      durationRaw = parts[1];
      reasonParts = parts.slice(2);
    } else {
      reasonParts = parts.slice(1);
    }
  }

  const targetUserId = resolveTargetUserId({
    replyFromId: replyFrom,
    arg: targetArg,
  });
  if (!targetUserId) {
    await ctx.reply(
      `Usage: reply to a user with /${action} [duration] [reason]\nOr: /${action} <telegram_user_id> [duration] [reason]\nDuration examples: 30m, 2h, 1d`,
    );
    return;
  }

  const durationSec =
    action === "mute" || action === "ban"
      ? parseDurationSeconds(durationRaw)
      : undefined;

  try {
    const result = await adminModerationService.execute({
      groupId: runtime.group.id,
      telegramChatId: telegramId,
      employerUserId: runtime.employerUserId,
      billable: runtime.billable,
      action,
      targetUserId,
      durationSec,
      reason: reasonParts.join(" ") || undefined,
      roseRelayEnabled: Boolean(runtime.group.settings?.roseRelayEnabled),
      roseBotUsername: runtime.group.settings?.roseBotUsername,
    });
    await ctx.reply(result.message);
  } catch (err) {
    await ctx.reply(err instanceof Error ? err.message : "Moderation failed.");
  }
}

async function startGroupActivityCommand(
  ctx: Context,
  type: "poll" | "learn" | "game" | "fun",
) {
  if (!isGroupChat(ctx)) {
    await ctx.reply(`Use /${type === "learn" ? "trivia" : type} inside the group.`);
    return;
  }
  const telegramId = chatIdOf(ctx);
  const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
  if (!telegramId || !fromUserId) return;
  const runtime = await resolveGroupRuntime(telegramId);
  if (!runtime?.communityMode) {
    await ctx.reply("Community mode isn't enabled here.");
    return;
  }
  const { engagementService } = await import("@/services/engagement.service");
  const { contextService } = await import("@/services/context.service");
  if (!engagementService.typeAllowed(type, runtime.group.settings)) {
    await ctx.reply(
      `${type} activities are disabled. Enable them under group Capabilities.`,
    );
    return;
  }
  try {
    const context = await contextService.build(runtime.group.id);
    const activity = await engagementService.inventActivity({
      groupId: runtime.group.id,
      type,
      context,
      guidelines: runtime.group.settings?.engagementGuidelines,
      createdByUserId: runtime.employerUserId,
      hint: commandArgs(ctx, type === "learn" ? "trivia" : type),
    });
    if (type === "poll" || type === "learn" || type === "game") {
      await engagementService.postTelegramPoll(ctx, activity);
    } else {
      await ctx.reply(
        [`**${activity.title}**`, activity.description ?? ""].filter(Boolean).join("\n"),
      );
    }
  } catch (err) {
    await ctx.reply(err instanceof Error ? err.message : "Could not start activity.");
  }
}

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    if (isPrivateChat(ctx)) {
      await openEmployerMenu(ctx);
      return;
    }
    const username = await botUsername(ctx);
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        "I'm here for this group. Admins: enable community mode in the dashboard.",
        "Type / to see group commands (moderation, announce, birthday).",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    if (isPrivateChat(ctx)) {
      await openEmployerMenu(ctx);
      return;
    }
    const username = await botUsername(ctx);
    await ctx.reply(capabilitiesSummary(username));
  });

  bot.command("menu", async (ctx) => {
    await openEmployerMenu(ctx);
  });

  bot.command("report", async (ctx) => {
    if (!isPrivateChat(ctx)) {
      await ctx.reply("Ask for a work report in a private chat with me.");
      return;
    }
    const linked = await findLinkedUserByTelegram(
      ctx.from?.id ? String(ctx.from.id) : null,
    );
    if (!linked?.user) {
      await replyDm(ctx, "Link your Telegram ID in dashboard Settings first.");
      return;
    }
    const report = await employerAgentService.formatDirectReport(
      linked.user.id,
      "report",
    );
    await replyDm(ctx, report.slice(0, 3900));
  });

  bot.command("groups", async (ctx) => {
    if (!isPrivateChat(ctx)) {
      await ctx.reply("Manage groups from a private chat with me (/menu).");
      return;
    }
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    const linked = await findLinkedUserByTelegram(fromUserId);
    if (!linked?.user || !fromUserId) {
      await replyDm(ctx, "Link your Telegram ID in dashboard Settings first.");
      return;
    }
    await employerDmService.handleCallback({
      data: "emp:groups",
      userId: linked.user.id,
      telegramUserId: fromUserId,
      answerCb: async () => undefined,
      editOrReply: async (text, keyboard) => {
        await ctx.reply(text, keyboard ? { reply_markup: keyboard } : dmMenuExtra(ctx));
      },
    });
  });

  bot.command("spam", async (ctx) => {
    if (!isPrivateChat(ctx)) {
      await ctx.reply("Spam summaries are available in a private chat with me.");
      return;
    }
    const linked = await findLinkedUserByTelegram(
      ctx.from?.id ? String(ctx.from.id) : null,
    );
    if (!linked?.user) {
      await replyDm(ctx, "Link your Telegram ID in dashboard Settings first.");
      return;
    }
    const brief = await employerAgentService.buildSpamBrief(linked.user.id);
    await replyDm(ctx, brief.slice(0, 3900));
  });

  bot.command("agreement", async (ctx) => {
    if (!isPrivateChat(ctx)) {
      await ctx.reply("Read the Employment Agreement in a private chat with me (/agreement).");
      return;
    }
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    const linked = await findLinkedUserByTelegram(fromUserId);
    if (!linked?.user || !fromUserId) {
      await replyDm(
        ctx,
        "Link your Telegram ID in dashboard Settings, then ask again for the Employment Agreement.",
      );
      return;
    }
    await employerDmService.handleCallback({
      data: "emp:agreement",
      userId: linked.user.id,
      telegramUserId: fromUserId,
      answerCb: async () => undefined,
      editOrReply: async (text, keyboard) => {
        await ctx.reply(text, keyboard ? { reply_markup: keyboard } : dmMenuExtra(ctx));
      },
    });
  });

  bot.command("status", async (ctx) => {
    const telegramUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramUserId) return;
    const settings = await prisma.settings.findFirst({
      where: { telegramUserId },
      include: { user: { include: { employment: true, wallet: true } } },
    });
    if (!settings?.user) {
      await replyDm(
        ctx,
        "No linked dashboard account. Connect your Telegram user ID in Settings.",
      );
      return;
    }
    let available: number | null = null;
    try {
      available = (await billingService.getBalanceLedger(settings.user.id)).availableBalance;
    } catch {
      available = null;
    }
    await replyDm(
      ctx,
      [
        `Account: ${settings.user.email}`,
        `Employment: ${settings.user.employment?.status ?? "Inactive"}`,
        `Wallet: ${settings.user.wallet?.address ?? "none"}`,
        available == null
          ? "Available balance: (unavailable)"
          : `Available balance: ${available}`,
        "",
        isPrivateChat(ctx)
          ? "Use the buttons below, or type / for more commands."
          : "DM me for the employer action menu.",
      ].join("\n"),
    );
  });

  bot.command("remember", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("Use /remember in a group where member memory is enabled.");
      return;
    }
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) {
      await ctx.reply("Community mode isn't enabled here.");
      return;
    }
    const note = commandArgs(ctx, "remember");
    if (!note) {
      await ctx.reply("Usage: /remember I asked about vesting last week");
      return;
    }
    try {
      await memoryService.remember({
        groupId: runtime.group.id,
        telegramUserId: fromUserId,
        note,
        employerUserId: runtime.employerUserId,
        billable: runtime.billable,
      });
      await ctx.reply("Saved with your consent. Use /forget to clear.");
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Could not save memory.");
    }
  });

  bot.command("forget", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime) return;
    await memoryService.forget(runtime.group.id, fromUserId);
    await ctx.reply("Memory cleared for this group.");
  });

  for (const action of ["ban", "unban", "mute", "unmute"] as ModerationAction[]) {
    bot.command(action, async (ctx) => {
      await runModerationCommand(ctx, action);
    });
  }

  bot.command("announce", async (ctx) => {
    const text = commandArgs(ctx, "announce");
    if (!text) {
      await ctx.reply("Usage: /announce Your announcement text");
      return;
    }
    if (!isGroupChat(ctx)) {
      await ctx.reply("Use /announce inside the target group.");
      return;
    }
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) {
      await ctx.reply("Community mode isn't enabled here.");
      return;
    }
    if (runtime.group.settings?.announcementsEnabled === false) {
      await ctx.reply("Announcements are disabled in group settings.");
      return;
    }
    if (!isAdminSender(runtime.adminTelegramIds, fromUserId)) {
      await ctx.reply("Only group admins can post announcements.");
      return;
    }
    try {
      await announcementService.postNow({
        groupId: runtime.group.id,
        telegramChatId: telegramId,
        text,
        userId: runtime.employerUserId,
        billable: runtime.billable,
        personaRole: runtime.group.settings?.personaRole,
      });
      await ctx.reply("Announcement posted.");
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Announce failed.");
    }
  });

  bot.command("poll", async (ctx) => {
    await startGroupActivityCommand(ctx, "poll");
  });
  bot.command("trivia", async (ctx) => {
    await startGroupActivityCommand(ctx, "learn");
  });
  bot.command("campaign", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("Use /campaign inside the group with a Twitter/X URL.");
      return;
    }
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) {
      await ctx.reply("Community mode isn't enabled here.");
      return;
    }
    if (!isAdminSender(runtime.adminTelegramIds, fromUserId)) {
      await ctx.reply("Only admins can launch social campaigns.");
      return;
    }
    const arg = commandArgs(ctx, "campaign");
    const { engagementService } = await import("@/services/engagement.service");
    const url = engagementService.extractUrl(arg);
    if (!url) {
      await ctx.reply("Usage: /campaign https://x.com/.../status/... [like|retweet]");
      return;
    }
    const action = /\blike\b/i.test(arg) ? "like" : "retweet";
    try {
      const activity = await engagementService.createSocialCampaign({
        groupId: runtime.group.id,
        targetUrl: url,
        action,
        createdByUserId: runtime.employerUserId,
      });
      await ctx.reply(
        [
          `Social campaign live: ${activity.title}`,
          `Do the ${action} on: ${url}`,
          `Then tag Sentry with your proof link (+${activity.pointsReward} pts).`,
        ].join("\n"),
      );
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Campaign failed.");
    }
  });

  bot.command("points", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("Use /points inside a group.");
      return;
    }
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) {
      await ctx.reply("Community mode isn't enabled here.");
      return;
    }
    const arg = commandArgs(ctx, "points").toLowerCase();
    const { rewardService } = await import("@/services/reward.service");
    if (arg.includes("top") || arg.includes("board")) {
      const top = await rewardService.leaderboard(runtime.group.id, 8);
      const lines = top.map(
        (m, i) =>
          `${i + 1}. ${m.username ? `@${m.username}` : m.telegramUserId} — ${m.points}`,
      );
      await ctx.reply(lines.length ? `Leaderboard:\n${lines.join("\n")}` : "No points yet.");
      return;
    }
    const mine = await rewardService.getOrCreateMemberPoints({
      groupId: runtime.group.id,
      telegramUserId: fromUserId,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply(
      `Your points: ${mine.points} (lifetime ${mine.lifetimePoints}). Pending reward: ${mine.pendingReward.toString()}.`,
    );
  });

  bot.command("birthday", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("Use /birthday in a group (e.g. /birthday 07-20 or /birthday clear).");
      return;
    }
    const telegramId = chatIdOf(ctx);
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramId || !fromUserId) return;
    const runtime = await resolveGroupRuntime(telegramId);
    if (!runtime?.communityMode) {
      await ctx.reply("Community mode isn't enabled here.");
      return;
    }
    if (runtime.group.settings?.birthdaysEnabled === false) {
      await ctx.reply("Birthdays are disabled in group settings.");
      return;
    }
    const arg = commandArgs(ctx, "birthday").toLowerCase();
    if (arg === "clear" || arg === "off" || arg === "remove") {
      await birthdayService.clear(runtime.group.id, fromUserId);
      await ctx.reply("Birthday cleared for this group.");
      return;
    }
    const match = arg.match(/^(\d{1,2})[-/](\d{1,2})$/);
    if (!match) {
      await ctx.reply("Usage: /birthday MM-DD  (or /birthday clear)");
      return;
    }
    const month = Number(match[1]);
    const day = Number(match[2]);
    try {
      await birthdayService.set({
        groupId: runtime.group.id,
        telegramUserId: fromUserId,
        month,
        day,
        displayName: ctx.from?.username
          ? `@${ctx.from.username}`
          : ctx.from?.first_name ?? null,
      });
      await ctx.reply(
        `Saved birthday ${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.`,
      );
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Could not save birthday.");
    }
  });

  bot.command("mywallet", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) return;
    const text = await walletMessage(userId);
    await replyDm(ctx, text);
  });

  bot.command("balance", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) return;
    const text = await walletMessage(userId);
    await replyDm(ctx, text);
  });

  bot.command("deposit", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) return;
    const text = await walletMessage(userId);
    await replyDm(ctx, text);
  });
}
