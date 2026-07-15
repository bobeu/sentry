import type { Telegraf, Context } from "telegraf";
import { groupService } from "@/services/group.service";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { prisma } from "@/lib/prisma";

function chatId(ctx: Context) {
  return ctx.chat?.id != null ? String(ctx.chat.id) : null;
}

function isGroupChat(ctx: Context) {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

async function botUsername(ctx: Context) {
  const me = await ctx.telegram.getMe();
  return me.username?.toLowerCase() ?? "";
}

function mentionedBot(text: string, username: string) {
  if (!username) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes(`@${username}`) ||
    lower.includes("@sentry") ||
    /(^|\s)sentry[,:\s]/i.test(text)
  );
}

async function groupIsActive(telegramId: string) {
  const group = await groupService.findActiveGroupByTelegramId(telegramId);
  if (!group?.settings?.enabled) return null;

  const activeEmployer = group.employment.find(
    (link) =>
      link.enabled &&
      link.user.employment?.status === "Active" &&
      Number(link.user.wallet?.balance?.toString() ?? "0") > 0,
  );
  if (!activeEmployer) return null;
  return group;
}

export function registerHandlers(bot: Telegraf) {
  bot.catch((err) => {
    console.error("[telegram]", err);
  });

  bot.on("my_chat_member", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const chat = ctx.chat;
    if (!chat || !("title" in chat)) return;

    const member = ctx.myChatMember.new_chat_member;
    const status = member.status;
    if (status !== "member" && status !== "administrator") return;

    const owners = await ctx.telegram.getChatAdministrators(chat.id).catch(() => []);
    const creator = owners.find((a) => a.status === "creator");

    await groupService.upsertFromTelegram({
      telegramId: String(chat.id),
      name: chat.title,
      ownerTelegramId: creator?.user.id ? String(creator.user.id) : null,
      memberCount: "member_count" in chat ? (chat as { member_count?: number }).member_count ?? null : null,
    });
  });

  bot.on("new_chat_members", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const telegramId = chatId(ctx);
    if (!telegramId) return;

    const me = await ctx.telegram.getMe();
    const newcomers = ctx.message.new_chat_members ?? [];

    for (const member of newcomers) {
      if (member.id === me.id) {
        await groupService.upsertFromTelegram({
          telegramId,
          name: "title" in ctx.chat! ? ctx.chat.title : null,
        });
        continue;
      }

      const group = await groupIsActive(telegramId);
      if (!group?.settings?.welcomeMembers) continue;

      const context = await contextService.build(group.id);
      const name = member.username ? `@${member.username}` : member.first_name;
      try {
        const welcome = await aiService.generateWelcome({
          context,
          memberName: name,
        });
        await ctx.reply(welcome);
        await prisma.task.create({ data: { groupId: group.id } });
      } catch (err) {
        console.error("[welcome]", err);
        await ctx.reply(`Welcome ${name}!`);
      }
    }
  });

  bot.on("text", async (ctx) => {
    if (!isGroupChat(ctx) || !ctx.message || !("text" in ctx.message)) return;
    const telegramId = chatId(ctx);
    if (!telegramId) return;

    const groupRecord = await groupService.upsertFromTelegram({
      telegramId,
      name: "title" in ctx.chat! ? ctx.chat.title : null,
    });

    const text = ctx.message.text;
    await contextService.appendMessage({
      groupId: groupRecord.id,
      telegramMessageId: String(ctx.message.message_id),
      fromUserId: ctx.from?.id ? String(ctx.from.id) : null,
      fromUsername: ctx.from?.username ?? ctx.from?.first_name ?? null,
      text,
    });

    const group = await groupIsActive(telegramId);
    if (!group) return;

    const username = await botUsername(ctx);
    const isReplyToBot =
      ctx.message.reply_to_message?.from?.id === (await ctx.telegram.getMe()).id;
    const isMention = mentionedBot(text, username);

    if (!isMention && !isReplyToBot) return;
    if (!group.settings?.replyToMentions && !group.settings?.answerQuestions) return;

    const context = await contextService.build(group.id);
    const cleaned = text.replace(new RegExp(`@${username}`, "ig"), "").trim();

    try {
      const reply = await aiService.generateReply({
        context,
        userQuestion: cleaned || text,
        userName: ctx.from?.username ?? ctx.from?.first_name,
      });
      await ctx.reply(reply, { reply_to_message_id: ctx.message.message_id });
      await prisma.task.create({ data: { groupId: group.id } });
    } catch (err) {
      console.error("[mention]", err);
      await ctx.reply("I don't know.");
    }
  });
}
