import { prisma } from "@/lib/prisma";
import { getBot } from "@/services/telegram.service";
import { actionService } from "@/services/action.service";
import { splitTelegramMessage } from "@/lib/telegram-message";

function formatAnnouncement(text: string, personaRole?: string | null) {
  const body = text.trim();
  if (personaRole === "announcer") {
    return `📢 Announcement\n\n${body}`;
  }
  return body;
}

export class AnnouncementService {
  async postNow(input: {
    groupId: string;
    telegramChatId: string;
    text: string;
    userId?: string | null;
    billable?: boolean;
    personaRole?: string | null;
  }) {
    const text = formatAnnouncement(input.text, input.personaRole);
    if (!text.trim()) throw new Error("Announcement text is required");

    const row = await prisma.groupAnnouncement.create({
      data: {
        groupId: input.groupId,
        userId: input.userId ?? null,
        text,
        status: "scheduled",
        scheduledAt: new Date(),
      },
    });

    const bot = getBot();
    try {
      for (const chunk of splitTelegramMessage(text)) {
        await bot.telegram.sendMessage(Number(input.telegramChatId), chunk);
      }
      await prisma.groupAnnouncement.update({
        where: { id: row.id },
        data: { status: "posted", postedAt: new Date() },
      });
      if (input.userId) {
        await actionService.record({
          type: "announcement",
          groupId: input.groupId,
          userId: input.userId,
          billable: Boolean(input.billable),
          metadata: { announcementId: row.id, immediate: true },
        });
      }
      return row;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.groupAnnouncement.update({
        where: { id: row.id },
        data: { status: "failed", error: message.slice(0, 500) },
      });
      throw new Error(message);
    }
  }

  async schedule(input: {
    groupId: string;
    userId?: string | null;
    text: string;
    scheduledAt: Date;
  }) {
    const text = input.text.trim();
    if (!text) throw new Error("Announcement text is required");
    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new Error("scheduledAt must be in the future");
    }
    return prisma.groupAnnouncement.create({
      data: {
        groupId: input.groupId,
        userId: input.userId ?? null,
        text,
        status: "scheduled",
        scheduledAt: input.scheduledAt,
      },
    });
  }

  async runDuePass() {
    const now = new Date();
    const due = await prisma.groupAnnouncement.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: now },
      },
      include: {
        group: { include: { settings: true } },
      },
      take: 50,
    });

    const bot = getBot();
    for (const row of due) {
      if (row.group.settings?.announcementsEnabled === false) {
        await prisma.groupAnnouncement.update({
          where: { id: row.id },
          data: { status: "cancelled", error: "announcements disabled" },
        });
        continue;
      }
      const text = formatAnnouncement(
        row.text,
        row.group.settings?.personaRole,
      );
      try {
        for (const chunk of splitTelegramMessage(text)) {
          await bot.telegram.sendMessage(Number(row.group.telegramId), chunk);
        }
        await prisma.groupAnnouncement.update({
          where: { id: row.id },
          data: { status: "posted", postedAt: new Date(), text },
        });
        if (row.userId) {
          await actionService.record({
            type: "announcement",
            groupId: row.groupId,
            userId: row.userId,
            billable: true,
            metadata: { announcementId: row.id, scheduled: true },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.groupAnnouncement.update({
          where: { id: row.id },
          data: { status: "failed", error: message.slice(0, 500) },
        });
      }
    }
  }
}

export const announcementService = new AnnouncementService();
