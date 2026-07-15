import type { Telegraf } from "telegraf";

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Sentry — your AI community employee.",
        "",
        "Add me to a Telegram group, hire Sentry in the web app, then enable the group.",
        "I answer @mentions, welcome new members, and use your FAQs + recent chat context.",
        "",
        "Commands: /start /help",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "How to use Sentry:",
        "1. Hire Sentry in the dashboard",
        "2. Deposit prepaid funds",
        "3. Add this bot to your group",
        "4. Enable the group in the Groups page",
        "5. Mention @sentry (or reply to me) to ask a question",
        "",
        "I only respond when addressed. No billing in this version.",
      ].join("\n"),
    );
  });
}
