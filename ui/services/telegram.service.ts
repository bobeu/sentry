import { createBot } from "@/telegram/bot";
import { registerBotCommandMenu } from "@/telegram/bot-commands";
import type { Telegraf } from "telegraf";

let bot: Telegraf | null = null;
let commandsRegistered = false;

function requireToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return token;
}

function ensureCommandMenu(instance: Telegraf) {
  if (commandsRegistered) return;
  commandsRegistered = true;
  void registerBotCommandMenu(instance).catch((err) => {
    commandsRegistered = false;
    console.warn("[telegram] setMyCommands failed:", err);
  });
}

export function getBot(): Telegraf {
  if (bot) {
    ensureCommandMenu(bot);
    return bot;
  }

  bot = createBot(requireToken());
  ensureCommandMenu(bot);
  return bot;
}

type TelegramChatInfo = {
  id: number | string;
  title?: string;
  type?: string;
  description?: string;
  username?: string;
};

async function telegramApi<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const token = requireToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok || json.result === undefined) {
    throw new Error(json.description ?? `Telegram ${method} failed`);
  }
  return json.result;
}

export class TelegramService {
  getInstance() {
    return getBot();
  }

  async getChat(chatId: string): Promise<TelegramChatInfo> {
    return telegramApi<TelegramChatInfo>("getChat", { chat_id: chatId });
  }

  async getChatAdministrators(chatId: string) {
    return telegramApi<Array<{ user: { id: number; is_bot?: boolean } }>>(
      "getChatAdministrators",
      { chat_id: chatId },
    );
  }

  async getChatMemberCount(chatId: string): Promise<number | null> {
    try {
      return await telegramApi<number>("getChatMemberCount", { chat_id: chatId });
    } catch {
      return null;
    }
  }
}

export const telegramService = new TelegramService();
