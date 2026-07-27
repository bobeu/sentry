import { Telegraf } from "telegraf";
import { registerCommands } from "@/telegram/commands";
import { registerHandlers } from "@/telegram/handlers";

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);
  registerCommands(bot);
  registerHandlers(bot);
  return bot;
}
