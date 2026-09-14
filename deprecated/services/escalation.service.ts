import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";

const ESCALATE_PATTERNS =
  /\b(refund|legal|lawsuit|sue|guarantee|hack(ed)?|exploit|rug|private key|seed phrase|wire transfer|send (me )?funds|guaranteed returns?)\b/i;

export function shouldEscalate(text: string, viaFaq: boolean) {
  if (viaFaq) return false;
  if (ESCALATE_PATTERNS.test(text)) return true;
  if (text.length > 400 && text.includes("?")) return true;
  return false;
}

export class EscalationService {
  async createAndNotify(input: {
    groupId: string;
    userId: string;
    draftText: string;
    reason: string;
    sourceTelegramMsgId?: string;
    sourceChatId?: string;
    groupName?: string | null;
  }) {
    const employer = await prisma.settings.findFirst({
      where: { userId: input.userId },
    });
    if (!employer?.telegramUserId) return null;

    const escalation = await prisma.escalation.create({
      data: {
        groupId: input.groupId,
        userId: input.userId,
        draftText: input.draftText.slice(0, 3500),
        reason: input.reason.slice(0, 300),
        sourceTelegramMsgId: input.sourceTelegramMsgId ?? null,
        sourceChatId: input.sourceChatId ?? null,
      },
    });

    const bot = getBot();
    const msg = await bot.telegram
      .sendMessage(
        Number(employer.telegramUserId),
        [
          `Escalation — ${input.groupName ?? "group"}`,
          `Reason: ${input.reason}`,
          "",
          "Draft reply:",
          input.draftText.slice(0, 1200),
          "",
          "Approve, edit (reply with: edit: your text), or ignore.",
        ].join("\n"),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Approve", callback_data: `esc:ok:${escalation.id}` },
                { text: "Ignore", callback_data: `esc:no:${escalation.id}` },
              ],
            ],
          },
        },
      )
      .catch(() => null);

    if (msg) {
      await prisma.escalation.update({
        where: { id: escalation.id },
        data: { employerTelegramMsgId: String(msg.message_id) },
      });
    }

    await actionService.record({
      type: "escalation",
      groupId: input.groupId,
      userId: input.userId,
      billable: true,
      metadata: { escalationId: escalation.id, reason: input.reason },
    });

    return escalation;
  }

  async resolve(
    escalationId: string,
    userId: string,
    decision: "approved" | "ignored" | "edited",
    finalText?: string,
  ) {
    const esc = await prisma.escalation.findFirst({
      where: { id: escalationId, userId },
      include: { group: true },
    });
    if (!esc || esc.status !== "pending") return null;

    const text = (finalText ?? esc.draftText).trim();
    await prisma.escalation.update({
      where: { id: esc.id },
      data: {
        status: decision,
        finalText: decision === "ignored" ? null : text,
        resolvedAt: new Date(),
      },
    });

    if (decision !== "ignored" && esc.sourceChatId && text) {
      const bot = getBot();
      const opts =
        esc.sourceTelegramMsgId != null
          ? {
              reply_parameters: {
                message_id: Number(esc.sourceTelegramMsgId),
              },
            }
          : undefined;
      await bot.telegram
        .sendMessage(Number(esc.sourceChatId), text, opts)
        .catch(() =>
          bot.telegram.sendMessage(Number(esc.sourceChatId), text).catch(() => undefined),
        );
    }

    return esc;
  }

  async listPending(userId: string) {
    return prisma.escalation.findMany({
      where: { userId, status: "pending" },
      include: { group: { select: { id: true, name: true, telegramId: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

export const escalationService = new EscalationService();
