import type { Telegraf } from "telegraf";
import { prisma } from "@/lib/prisma";
import { walletService } from "@/services/wallet.service";
import { formatAmount } from "@/lib/payment-currency";
import { billingService } from "@/services/billing.service";
import { memoryService } from "@/services/memory.service";
import {
  botUsername,
  capabilitiesSummary,
  chatIdOf,
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

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    const username = await botUsername(ctx);
    await ctx.reply(
      [
        capabilitiesSummary(username),
        "",
        "Employers: hire & fund Sentry in the web app, add me to a group, then enable the group.",
        "Members: ask questions or mention me — I'll help using FAQs and live chat context.",
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
    const note = (ctx.message && "text" in ctx.message ? ctx.message.text : "")
      .replace(/^\/remember(@\w+)?\s*/i, "")
      .trim();
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
