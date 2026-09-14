import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";

export type IntentKind = "buy" | "support" | "scam" | null;

const BUY =
  /\b(where (can|do) i (buy|purchase)|how (to|do i) (buy|purchase|claim|bridge|swap)|price|token address|contract address|\bca\b)\b/i;
const SUPPORT =
  /\b(help|support|not working|can't (login|access)|error|bug|issue|stuck)\b/i;
const SCAM =
  /\b(airdrop claim|send (me )?(eth|bnb|celo|usdt)|double your|seed phrase|private key|connect wallet.*(urgent|now)|admin (dm|pm) me)\b/i;

export function detectIntent(text: string): IntentKind {
  if (SCAM.test(text)) return "scam";
  if (BUY.test(text)) return "buy";
  if (SUPPORT.test(text)) return "support";
  return null;
}

export class IntentService {
  async handle(input: {
    groupId: string;
    userId: string | null;
    text: string;
    fromUsername: string | null;
    groupName?: string | null;
    billable: boolean;
  }) {
    const intent = detectIntent(input.text);
    if (!intent || !input.userId) return null;

    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!settings?.intentSensing) return null;

    await actionService.record({
      type: "intent_signal",
      groupId: input.groupId,
      userId: input.userId,
      billable: input.billable,
      metadata: { intent, from: input.fromUsername, preview: input.text.slice(0, 200) },
    });

    const employer = await prisma.settings.findFirst({
      where: { userId: input.userId },
    });
    if (employer?.telegramUserId) {
      const bot = getBot();
      await bot.telegram
        .sendMessage(
          Number(employer.telegramUserId),
          [
            `Intent signal (${intent}) — ${input.groupName ?? "group"}`,
            `From: ${input.fromUsername ?? "member"}`,
            "",
            input.text.slice(0, 400),
          ].join("\n"),
        )
        .catch(() => undefined);
    }

    return intent;
  }
}

export const intentService = new IntentService();
