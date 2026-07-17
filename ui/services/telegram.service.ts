import { createBot } from "@/telegram/bot";
import type { Telegraf } from "telegraf";

let bot: Telegraf | null = null;

export function getBot(): Telegraf {
  if (bot) {
    return bot;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  bot = createBot(token);
  return bot;
}

export class TelegramService {
  getInstance() {
    return getBot();
  }
}

export const telegramService = new TelegramService();
