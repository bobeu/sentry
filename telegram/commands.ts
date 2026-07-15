import type { Telegraf } from "telegraf";
import { prisma } from "@/lib/prisma";
import { walletService } from "@/services/wallet.service";
import { paymentService } from "@/services/payment.service";
import { formatAmount } from "@/lib/payment-currency";

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

  const currency = await paymentService.getActiveCurrency();
  const synced = await walletService.syncBalanceFromChain(settings.user.id);
  const balance = synced?.balance ?? Number(wallet.balance.toString());

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
    "Current Balance",
    formatAmount(balance, currency),
  ].join("\n");
}

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Sentry — your AI community employee.",
        "",
        "Add me to a Telegram group, hire Sentry in the web app, then enable the group.",
        "I answer @mentions, welcome new members, and use your FAQs + recent chat context.",
        "",
        "Commands: /start /help /mywallet /balance /deposit",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "How to use Sentry:",
        "1. Hire Sentry in the dashboard",
        "2. Fund your employment wallet",
        "3. Add this bot to your group",
        "4. Enable the group in the Groups page",
        "5. Mention @sentry (or reply to me) to ask a question",
        "",
        "Wallet: /mywallet /balance /deposit",
        "Billing: pay per completed action in the active payment currency.",
      ].join("\n"),
    );
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
