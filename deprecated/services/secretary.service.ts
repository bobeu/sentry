import { prisma } from "@/lib/prisma";
import { getBot } from "@/services/telegram.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { faqService } from "@/services/faq.service";
import { aiService } from "@/services/ai.service";
import { contextService } from "@/services/context.service";
import { splitTelegramMessage } from "@/lib/telegram-message";
import { UNCERTAIN_REPLY } from "@/lib/messages";

async function sendAsBusiness(
  chatId: number,
  text: string,
  businessConnectionId: string,
) {
  const bot = getBot();
  for (const chunk of splitTelegramMessage(text)) {
    await bot.telegram
      .callApi(
        "sendMessage",
        {
          chat_id: chatId,
          text: chunk,
          business_connection_id: businessConnectionId,
        } as never,
      )
      .catch(() => undefined);
  }
}

type BusinessConnectionUpdate = {
  id: string;
  user: { id: number; username?: string; first_name?: string };
  user_chat_id: number;
  is_enabled: boolean;
  rights?: { can_reply?: boolean } | null;
};

type BusinessMessage = {
  message_id: number;
  chat: { id: number };
  text?: string;
  from?: { id: number; username?: string; first_name?: string };
  business_connection_id?: string;
};

function isSimpleGreeting(text: string) {
  return /^(hi|hello|hey|thanks|thank you|ok|okay|good morning|good evening)\b/i.test(
    text.trim(),
  );
}

function shouldEscalateSecretary(text: string, viaFaq: boolean) {
  if (viaFaq) return false;
  if (isSimpleGreeting(text)) return false;
  if (
    /\b(refund|legal|lawsuit|hack(ed)?|private key|seed phrase|wire transfer|guaranteed)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (text.length > 280 && text.includes("?")) return true;
  if (text.includes("?") && text.length > 40) return true;
  return text.length > 120;
}

export class SecretaryService {
  async upsertConnection(conn: BusinessConnectionUpdate) {
    const userTelegramId = String(conn.user.id);
    const linked = await prisma.settings.findFirst({
      where: { telegramUserId: userTelegramId },
      select: { userId: true },
    });
    const canReply = Boolean(conn.rights?.can_reply ?? conn.is_enabled);

    return prisma.businessConnectionRecord.upsert({
      where: { connectionId: conn.id },
      create: {
        connectionId: conn.id,
        userTelegramId,
        userChatId: String(conn.user_chat_id),
        canReply,
        isEnabled: conn.is_enabled,
        userId: linked?.userId ?? null,
        rightsJson: conn.rights ? JSON.stringify(conn.rights) : null,
      },
      update: {
        userTelegramId,
        userChatId: String(conn.user_chat_id),
        canReply,
        isEnabled: conn.is_enabled,
        userId: linked?.userId ?? null,
        rightsJson: conn.rights ? JSON.stringify(conn.rights) : null,
      },
    });
  }

  async handleBusinessMessage(message: BusinessMessage) {
    const connectionId = message.business_connection_id;
    const text = message.text?.trim();
    if (!connectionId || !text) return;

    const conn = await prisma.businessConnectionRecord.findUnique({
      where: { connectionId },
      include: {
        user: { include: { employment: true, wallet: true, settings: true } },
      },
    });
    if (!conn || !conn.isEnabled) return;

    // Relink if settings appeared after connect
    let userId = conn.userId;
    if (!userId) {
      const linked = await prisma.settings.findFirst({
        where: { telegramUserId: conn.userTelegramId },
      });
      if (linked?.userId) {
        userId = linked.userId;
        await prisma.businessConnectionRecord.update({
          where: { id: conn.id },
          data: { userId },
        });
      }
    }
    if (!userId) {
      const bot = getBot();
      await bot.telegram
        .sendMessage(
          Number(conn.userChatId),
          "Secretary Mode is connected, but your dashboard account isn't linked. Sign in and set your Telegram user ID in Settings.",
        )
        .catch(() => undefined);
      return;
    }

    let billable = false;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employment: true, wallet: true },
    });
    if (user?.employment?.status === "Active" && user.wallet) {
      try {
        const ledger = await billingService.getBalanceLedger(userId);
        billable = ledger.availableBalance > 0;
      } catch {
        billable = false;
      }
    }

    const link = await prisma.groupEmployment.findFirst({
      where: { userId, enabled: true },
      include: { group: { include: { faqs: true, settings: true } } },
      orderBy: { updatedAt: "desc" },
    });

    const faqs =
      link?.group.faqs.map((f) => ({ question: f.question, answer: f.answer })) ??
      [];
    const faqHit = faqService.matchDetailed(faqs, text);
    const strongFaq = Boolean(faqHit && faqHit.score >= 0.72);
    const simple = isSimpleGreeting(text);

    const bot = getBot();

    if ((strongFaq || simple) && conn.canReply) {
      let reply =
        strongFaq && faqHit
          ? faqHit.answer
          : "Thanks for your message — I'll get back to you shortly.";
      if (!strongFaq && simple && link?.group) {
        try {
          const context = await contextService.build(link.group.id);
          const generated = await aiService.generateReply({
            context,
            userQuestion: text,
            preferFaq: true,
            groupId: link.group.id,
          });
          reply = generated.text;
        } catch {
          // keep short default
        }
      }

      await sendAsBusiness(message.chat.id, reply, connectionId);

      await actionService.record({
        type: "secretary_reply",
        userId,
        groupId: link?.groupId ?? null,
        billable,
        metadata: {
          connectionId,
          viaFaq: strongFaq,
          simple,
          chatId: String(message.chat.id),
        },
      });
      return;
    }

    // Ambiguous → escalate to employer DM with draft
    let draft = UNCERTAIN_REPLY;
    if (link?.group) {
      try {
        const context = await contextService.build(link.group.id);
        const generated = await aiService.generateReply({
          context,
          userQuestion: text,
          preferFaq: false,
          groupId: link.group.id,
        });
        draft = generated.text;
      } catch {
        // keep uncertain
      }
    }

    const escalate = shouldEscalateSecretary(text, strongFaq) || !conn.canReply;
    if (!escalate && conn.canReply) {
      await sendAsBusiness(message.chat.id, draft, connectionId);
      await actionService.record({
        type: "secretary_reply",
        userId,
        groupId: link?.groupId ?? null,
        billable,
        metadata: { connectionId, autoDraft: true },
      });
      return;
    }

    const from =
      message.from?.username
        ? `@${message.from.username}`
        : message.from?.first_name ?? "contact";

    await bot.telegram
      .sendMessage(
        Number(conn.userChatId),
        [
          "Secretary Mode — needs your review",
          `From: ${from}`,
          "",
          `Incoming:\n${text.slice(0, 800)}`,
          "",
          `Draft reply:\n${draft.slice(0, 1200)}`,
          "",
          conn.canReply
            ? 'Reply with: sec: <your text> to send as you, or ignore.'
            : "Write permission is off for this connection — enable reply rights in Telegram Business settings.",
        ].join("\n"),
        conn.canReply
          ? {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Send draft",
                      callback_data: `sec:ok:${connectionId}:${message.chat.id}:${message.message_id}`,
                    },
                    { text: "Ignore", callback_data: `sec:no:${connectionId}` },
                  ],
                ],
              },
            }
          : undefined,
      )
      .catch(() => undefined);

    // Stash draft on a lightweight pending store via Action metadata / temporary playbook-less:
    await prisma.businessConnectionRecord.update({
      where: { id: conn.id },
      data: {
        rightsJson: JSON.stringify({
          ...(conn.rightsJson ? JSON.parse(conn.rightsJson) : {}),
          pendingDraft: draft.slice(0, 3500),
          pendingChatId: String(message.chat.id),
          pendingMessageId: String(message.message_id),
        }),
      },
    });

    await actionService.record({
      type: "secretary_escalation",
      userId,
      groupId: link?.groupId ?? null,
      billable,
      metadata: {
        connectionId,
        chatId: String(message.chat.id),
        from,
      },
    });
  }

  async approvePending(connectionId: string, userTelegramId: string) {
    const conn = await prisma.businessConnectionRecord.findFirst({
      where: { connectionId, userTelegramId, isEnabled: true },
    });
    if (!conn?.rightsJson) return false;
    let pending: {
      pendingDraft?: string;
      pendingChatId?: string;
    };
    try {
      pending = JSON.parse(conn.rightsJson) as {
        pendingDraft?: string;
        pendingChatId?: string;
      };
    } catch {
      return false;
    }
    if (!pending.pendingDraft || !pending.pendingChatId || !conn.canReply) {
      return false;
    }
    await sendAsBusiness(
      Number(pending.pendingChatId),
      pending.pendingDraft,
      connectionId,
    );
    await prisma.businessConnectionRecord.update({
      where: { id: conn.id },
      data: {
        rightsJson: JSON.stringify({
          ...pending,
          pendingDraft: null,
          pendingChatId: null,
          pendingMessageId: null,
        }),
      },
    });
    return true;
  }

  async sendAsUser(input: {
    connectionId: string;
    userTelegramId: string;
    text: string;
  }) {
    const conn = await prisma.businessConnectionRecord.findFirst({
      where: {
        connectionId: input.connectionId,
        userTelegramId: input.userTelegramId,
        isEnabled: true,
      },
    });
    if (!conn?.canReply) throw new Error("No active secretary connection with reply rights.");
    let chatId: string | null = null;
    if (conn.rightsJson) {
      try {
        const parsed = JSON.parse(conn.rightsJson) as { pendingChatId?: string };
        chatId = parsed.pendingChatId ?? null;
      } catch {
        chatId = null;
      }
    }
    if (!chatId) throw new Error("No pending chat to reply to. Wait for a new message first.");

    await sendAsBusiness(Number(chatId), input.text, input.connectionId);
    return true;
  }
}

export const secretaryService = new SecretaryService();
