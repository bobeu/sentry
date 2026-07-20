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
import {
  botUsername,
  capabilitiesSummary,
  chatIdOf,
  isAdminSender,
  isGroupChat,
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

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    const username = await botUsername(ctx);
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        "Employers: hire & fund Sentry in the web app, add me to a group, then enable the group.",
        "Members: ask questions or mention me — I'll help using FAQs and live chat context.",
        "",
        "Secretary Mode: Telegram → Settings → Business → Chatbots → connect @" +
          (username || "tgemployee_bot") +
          " so I can read/reply in your selected personal chats.",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    const username = await botUsername(ctx);
    await ctx.reply(capabilitiesSummary(username));
  });

  bot.command("status", async (ctx) => {
    const telegramUserId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!telegramUserId) return;
    const settings = await prisma.settings.findFirst({
      where: { telegramUserId },
      include: { user: { include: { employment: true, wallet: true } } },
    });
    if (!settings?.user) {
      await ctx.reply("No linked dashboard account. Connect your Telegram user ID in Settings.");
      return;
    }
    let available: number | null = null;
    try {
      available = (await billingService.getBalanceLedger(settings.user.id)).availableBalance;
    } catch {
      available = null;
    }
    await ctx.reply(
      [
        `Account: ${settings.user.email}`,
        `Employment: ${settings.user.employment?.status ?? "Inactive"}`,
        `Wallet: ${settings.user.wallet?.address ?? "none"}`,
        available == null ? "Available balance: (unavailable)" : `Available balance: ${available}`,
        "",
        "I'm an AI agent on Telegram — mention me in an enabled group or chat here in DM.",
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
    await ctx.reply(text).catch(() => undefined);
  });

  bot.command("balance", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) return;
    const text = await walletMessage(userId);
    await ctx.reply(text).catch(() => undefined);
  });

  bot.command("deposit", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) return;
    const text = await walletMessage(userId);
    await ctx.reply(text).catch(() => undefined);
  });
}
