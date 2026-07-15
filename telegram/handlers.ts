import type { Telegraf, Context } from "telegraf";
import { groupService } from "@/services/group.service";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { actionService } from "@/services/action.service";
import { moderationService } from "@/services/moderation.service";
import { notificationService } from "@/services/notification.service";

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

async function resolveActiveEmployer(telegramId: string) {
  const group = await groupService.findActiveGroupByTelegramId(telegramId);
  if (!group?.settings?.enabled) return null;

  const activeEmployer = group.employment.find(
    (link) =>
      link.enabled &&
      link.user.employment?.status === "Active" &&
      Number(link.user.wallet?.balance?.toString() ?? "0") > 0,
  );
  if (!activeEmployer) return null;
  return { group, employerUserId: activeEmployer.userId };
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

    const admins = await ctx.telegram.getChatAdministrators(chat.id).catch(() => []);
    const adminIds = admins.map((a) => String(a.user.id));

    await groupService.upsertFromTelegram({
      telegramId: String(chat.id),
      name: chat.title,
      adminTelegramIds: adminIds,
      memberCount:
        "member_count" in chat
          ? ((chat as { member_count?: number }).member_count ?? null)
          : null,
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
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat!.id).catch(() => []);
        await groupService.upsertFromTelegram({
          telegramId,
          name: "title" in ctx.chat! ? ctx.chat.title : null,
          adminTelegramIds: admins.map((a) => String(a.user.id)),
        });
        continue;
      }

      const active = await resolveActiveEmployer(telegramId);
      if (!active?.group.settings?.welcomeMembers) continue;

      const context = await contextService.build(active.group.id);
      const name = member.username ? `@${member.username}` : member.first_name;
      try {
        const welcome = await aiService.generateWelcome({
          context,
          memberName: name,
        });
        await ctx.reply(welcome);
        await actionService.record({
          type: "welcome",
          groupId: active.group.id,
          userId: active.employerUserId,
          billable: true,
          metadata: { member: name },
        });
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
    const fromUserId = ctx.from?.id ? String(ctx.from.id) : null;
    const fromUsername = ctx.from?.username ?? ctx.from?.first_name ?? null;

    await contextService.appendMessage({
      groupId: groupRecord.id,
      telegramMessageId: String(ctx.message.message_id),
      fromUserId,
      fromUsername,
      text,
    });

    const active = await resolveActiveEmployer(telegramId);
    if (!active) return;

    // Mention notifications for monitored users (non-bot mentions)
    await notificationService.handlePossibleMention({
      groupId: active.group.id,
      text,
      fromUsername,
    });

    // Moderation
    if (active.group.settings?.spamModeration) {
      const verdict = moderationService.inspect({
        text,
        fromUserId,
        groupId: active.group.id,
      });
      if (verdict.spam) {
        try {
          await ctx.deleteMessage(ctx.message.message_id);
        } catch {
          // missing delete permission
        }
        await ctx
          .reply(
            `Warning: message removed (${verdict.reason ?? "spam"}). Please follow group rules.`,
          )
          .catch(() => undefined);

        if (active.group.adminTelegramIds) {
          try {
            const admins = JSON.parse(active.group.adminTelegramIds) as string[];
            for (const adminId of admins.slice(0, 5)) {
              await ctx.telegram
                .sendMessage(
                  Number(adminId),
                  `Moderation in ${active.group.name ?? telegramId}: removed spam (${verdict.reason}) from ${fromUsername ?? fromUserId}`,
                )
                .catch(() => undefined);
            }
          } catch {
            // ignore
          }
        }

        await actionService.record({
          type: "spam_moderation",
          groupId: active.group.id,
          userId: active.employerUserId,
          billable: true,
          metadata: { reason: verdict.reason, confidence: verdict.confidence },
        });
        return;
      }
    }

    const username = await botUsername(ctx);
    const me = await ctx.telegram.getMe();
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === me.id;
    const isMention = mentionedBot(text, username);

    if (!isMention && !isReplyToBot) return;
    if (!active.group.settings?.replyToMentions && !active.group.settings?.answerQuestions) {
      return;
    }

    const context = await contextService.build(active.group.id);
    const cleaned = text.replace(new RegExp(`@${username}`, "ig"), "").trim();

    try {
      const result = await aiService.generateReply({
        context,
        userQuestion: cleaned || text,
        userName: fromUsername ?? undefined,
      });
      await ctx.reply(result.text, { reply_to_message_id: ctx.message.message_id });
      await actionService.record({
        type: result.viaFaq ? "faq_answer" : "mention_reply",
        groupId: active.group.id,
        userId: active.employerUserId,
        billable: true,
        metadata: { viaFaq: result.viaFaq },
      });
    } catch (err) {
      console.error("[mention]", err);
      await ctx.reply("I don't know.");
      await actionService.record({
        type: "mention_reply",
        groupId: active.group.id,
        userId: active.employerUserId,
        billable: false,
        status: "failed",
      });
    }
  });
}
