import { prisma } from "@/lib/prisma";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";
import { logEvent } from "@/lib/logger";

export class SummaryService {
  async generateForGroup(groupId: string) {
    const group = await prisma.telegramGroup.findUnique({
      where: { id: groupId },
      include: {
        settings: true,
        employment: { where: { enabled: true }, include: { user: { include: { settings: true } } } },
      },
    });
    if (!group?.settings?.enabled) return null;

    const context = await contextService.build(groupId);
    const summary = await aiService.generateDailySummary(context);

    await prisma.report.create({
      data: {
        groupId,
        userId: group.employment[0]?.userId ?? null,
        content: summary,
        kind: "daily",
      },
    });

    const employerId = group.employment[0]?.userId ?? null;
    await actionService.record({
      type: "daily_summary",
      groupId,
      userId: employerId,
      billable: true,
      metadata: { length: summary.length },
    });

    const bot = getBot();
    const chatId = Number(group.telegramId);

    if (group.settings.summaryToGroup) {
      await bot.telegram.sendMessage(chatId, `Daily summary for ${group.name ?? "this group"}:\n\n${summary}`).catch(() => undefined);
    }

    if (group.settings.summaryToAdmins && group.adminTelegramIds) {
      try {
        const admins = JSON.parse(group.adminTelegramIds) as string[];
        for (const adminId of admins) {
          await bot.telegram
            .sendMessage(Number(adminId), `Daily summary — ${group.name ?? group.telegramId}:\n\n${summary}`)
            .catch(() => undefined);
        }
      } catch {
        // ignore bad JSON
      }
    }

    if (group.settings.summaryToPrivate) {
      for (const link of group.employment) {
        const tgId = link.user.settings?.telegramUserId;
        if (tgId) {
          await bot.telegram
            .sendMessage(Number(tgId), `Daily summary — ${group.name ?? group.telegramId}:\n\n${summary}`)
            .catch(() => undefined);
        }
      }
    }

    logEvent("Summary Generated", { groupId, employerId });

    if (group.settings.shiftHandover) {
      try {
        const { handoverService } = await import("@/services/handover.service");
        await handoverService.generateShiftHandover(groupId);
      } catch (err) {
        console.error("[summary:handover]", groupId, err);
      }
    }

    return summary;
  }

  async runHourlyPass(hourUtc: number) {
    const groups = await prisma.groupSettings.findMany({
      where: { enabled: true, dailySummaryHour: hourUtc },
      select: { groupId: true },
    });
    for (const g of groups) {
      try {
        await this.generateForGroup(g.groupId);
      } catch (err) {
        console.error("[summary]", g.groupId, err);
      }
    }
  }
}

export const summaryService = new SummaryService();
