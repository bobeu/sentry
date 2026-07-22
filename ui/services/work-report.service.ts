import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";
import { generateWorkReportNarrative } from "@/services/moderation-agent.service";
import { PRICING_LABELS } from "@/lib/pricing";

/**
 * Periodic employer work reports (default every 24h per group settings).
 */
export class WorkReportService {
  async generateForGroup(groupId: string) {
    const group = await prisma.telegramGroup.findUnique({
      where: { id: groupId },
      include: {
        settings: true,
        employment: {
          where: { enabled: true },
          include: { user: { include: { settings: true, employment: true } } },
        },
      },
    });
    if (!group?.settings?.enabled) return null;

    const intervalHours = Math.max(
      1,
      Math.min(168, group.settings.workReportIntervalHours ?? 24),
    );
    const since =
      group.settings.lastWorkReportAt ??
      new Date(Date.now() - intervalHours * 3600_000);

    const actions = await prisma.actionRecord.findMany({
      where: {
        groupId,
        status: "completed",
        completedAt: { gte: since },
      },
      orderBy: { completedAt: "desc" },
      take: 80,
    });

    const counts = new Map<string, number>();
    let spamDeleted = 0;
    let spamMuted = 0;
    let spamBanned = 0;
    let spamWarned = 0;
    for (const a of actions) {
      counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
      if (a.type === "spam_moderation") {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        const taken = String(meta.actionTaken ?? "");
        if (taken === "delete") spamDeleted++;
        else if (taken === "mute") spamMuted++;
        else if (taken === "ban") spamBanned++;
        else spamWarned++;
      }
    }

    const statsBlock = [
      `Window: since ${since.toISOString()} (~${intervalHours}h cadence)`,
      `Total actions: ${actions.length}`,
      ...[...counts.entries()].map(
        ([t, n]) => `- ${(PRICING_LABELS as Record<string, string>)[t] ?? t}: ${n}`,
      ),
      `Spam: deleted=${spamDeleted} muted=${spamMuted} banned=${spamBanned} warned=${spamWarned}`,
    ].join("\n");

    let narrative: string;
    try {
      narrative = await generateWorkReportNarrative({
        groupName: group.name ?? group.telegramId,
        statsBlock,
      });
    } catch {
      narrative = statsBlock;
    }

    const content = [
      `Sentry work report — ${group.name ?? group.telegramId}`,
      "",
      narrative,
      "",
      "—",
      statsBlock,
    ].join("\n");

    const employerId = group.employment[0]?.userId ?? null;
    await prisma.report.create({
      data: {
        groupId,
        userId: employerId,
        content,
        kind: "work",
      },
    });

    await prisma.groupSettings.update({
      where: { groupId },
      data: { lastWorkReportAt: new Date() },
    });

    await actionService.record({
      type: "daily_summary",
      groupId,
      userId: employerId,
      billable: true,
      metadata: { kind: "work_report", intervalHours, actionCount: actions.length },
    });

    const bot = getBot();
    for (const link of group.employment) {
      if (link.user.employment?.status !== "Active") continue;
      const tgId = link.user.settings?.telegramUserId;
      if (!tgId) continue;
      await bot.telegram
        .sendMessage(Number(tgId), content.slice(0, 3900))
        .catch(() => undefined);
    }

    return content;
  }

  /** Hourly pass: send reports for groups whose interval elapsed. */
  async runHourlyPass() {
    const settings = await prisma.groupSettings.findMany({
      where: { enabled: true },
      select: {
        groupId: true,
        workReportIntervalHours: true,
        lastWorkReportAt: true,
      },
    });

    const now = Date.now();
    for (const s of settings) {
      const hours = Math.max(1, Math.min(168, s.workReportIntervalHours ?? 24));
      const dueAt =
        (s.lastWorkReportAt?.getTime() ?? 0) + hours * 3600_000;
      if (now < dueAt) continue;
      try {
        await this.generateForGroup(s.groupId);
      } catch (err) {
        console.error("[work-report]", s.groupId, err);
      }
    }
  }
}

export const workReportService = new WorkReportService();
