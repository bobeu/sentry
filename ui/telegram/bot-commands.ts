import type { Telegraf } from "telegraf";

/** Commands shown when the user types `/` in a private chat with Sentry. */
export const PRIVATE_BOT_COMMANDS = [
  { command: "start", description: "Open Sentry welcome & action menu" },
  { command: "menu", description: "Show employer action buttons" },
  { command: "help", description: "What Sentry can do" },
  { command: "status", description: "Account & employment status" },
  { command: "report", description: "Recent work report" },
  { command: "groups", description: "Groups Sentry manages for you" },
  { command: "spam", description: "Spam moderation summary" },
  { command: "mywallet", description: "Employment wallet address" },
  { command: "balance", description: "Available wallet balance" },
  { command: "deposit", description: "How to fund your wallet" },
] as const;

/** Commands shown when the user types `/` inside a group. */
export const GROUP_BOT_COMMANDS = [
  { command: "help", description: "What Sentry can do in this group" },
  { command: "ban", description: "Ban a member (reply or user id)" },
  { command: "unban", description: "Unban a member" },
  { command: "mute", description: "Mute a member (optional duration)" },
  { command: "unmute", description: "Unmute a member" },
  { command: "announce", description: "Post an announcement" },
  { command: "birthday", description: "Set birthday MM-DD or clear" },
  { command: "remember", description: "Save a consented memory note" },
  { command: "forget", description: "Clear your memory note here" },
] as const;

/**
 * Registers BotFather-style command menus so typing `/` opens suggestions.
 * Private and group scopes differ; inline employer buttons stay DM-only elsewhere.
 */
export async function registerBotCommandMenu(bot: Telegraf) {
  const privateCmds = PRIVATE_BOT_COMMANDS.map((c) => ({
    command: c.command,
    description: c.description,
  }));
  const groupCmds = GROUP_BOT_COMMANDS.map((c) => ({
    command: c.command,
    description: c.description,
  }));

  await bot.telegram.setMyCommands(privateCmds);
  await bot.telegram.setMyCommands(privateCmds, {
    scope: { type: "all_private_chats" },
  });
  await bot.telegram.setMyCommands(groupCmds, {
    scope: { type: "all_group_chats" },
  });
  // Prefer the commands menu button in private chats.
  await bot.telegram
    .setChatMenuButton({
      menuButton: { type: "commands" },
    })
    .catch(() => undefined);

  console.log(
    `[telegram] command menu registered (private=${privateCmds.length}, group=${groupCmds.length})`,
  );
}
