import { prisma } from "@/lib/prisma";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";

export class NotificationService {
  /**
   * If a monitored Sentry user (by telegram username/id in Settings) is @mentioned
   * in an enabled group, notify them privately.
   */
  async handlePossibleMention(input: {
    groupId: string;
    text: string;
    fromUsername?: string | null;
  }) {
    const group = await prisma.telegramGroup.findUnique({
      where: { id: input.groupId },
      include: {
        settings: true,
        employment: {
          where: { enabled: true },
          include: { user: { include: { settings: true, employment: true, wallet: true } } },
        },
      },
    });
    if (!group?.settings?.enabled || !group.settings.mentionNotifications) return;

    const lower = input.text.toLowerCase();
    const mentions = [...lower.matchAll(/@([a-zA-Z0-9_]{5,32})/g)].map((m) => m[1]);
    if (mentions.length === 0) return;

    const bot = getBot();
    const context = await contextService.build(group.id);

    for (const link of group.employment) {
      const settings = link.user.settings;
      if (!settings?.telegramUsername && !settings?.telegramUserId) continue;
      const uname = settings.telegramUsername?.replace(/^@/, "").toLowerCase();
      if (!uname || !mentions.includes(uname)) continue;
      if (!settings.telegramUserId) continue;

      // Don't notify if the mentioned user is the speaker
      if (input.fromUsername?.toLowerCase() === uname) continue;

      const active =
        link.user.employment?.status === "Active" &&
        Number(link.user.wallet?.balance?.toString() ?? "0") > 0;
      if (!active) continue;

      try {
        const body = await aiService.generateMentionDigest({
          context,
          mentionedUsername: uname,
          triggerText: input.text,
        });
        await bot.telegram.sendMessage(
          Number(settings.telegramUserId),
          `You were mentioned in "${group.name ?? "a group"}".\n\n${body}`,
        );
        await actionService.record({
          type: "mention_notification",
          groupId: group.id,
          userId: link.userId,
          billable: true,
          metadata: { mentioned: uname },
        });
      } catch (err) {
        console.error("[mention-notify]", err);
      }
    }
  }
}

export const notificationService = new NotificationService();
