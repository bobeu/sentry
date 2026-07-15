import type { Telegraf } from "telegraf";

export function registerHandlers(bot: Telegraf) {
  bot.catch((error) => {
    console.error("[telegram] bot error", error);
  });
}
