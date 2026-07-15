import type { Telegraf } from "telegraf";
import { APP_NAME } from "@/lib/constants";

export function registerCommands(bot: Telegraf) {
  bot.start(async (ctx) => {
    await ctx.reply(
      `Welcome to ${APP_NAME}.\n\nI am your AI community employee for Telegram.\nUse /help to see available commands.`,
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      `${APP_NAME} commands:\n\n/start — introduce Sentry\n/help — show this message\n\nMore capabilities are coming soon.`,
    );
  });
}
