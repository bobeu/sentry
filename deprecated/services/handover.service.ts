import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { contextService } from "@/services/context.service";
import { getBot } from "@/services/telegram.service";
import { PRICING_LABELS } from "@/lib/pricing";

export class HandoverService {
  async generateShiftHandover(groupId: string) {
    const group = await prisma.telegramGroup.findUnique({
      where: { id: groupId },
      include: {
        settings: true,
        employment: {
          where: { enabled: true },
          include: { user: { include: { settings: true } } },
        },
      },
    });
    if (!group?.settings?.enabled || !group.settings.shiftHandover) return null;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [actions, context, pendingEscalations] = await Promise.all([
      prisma.actionRecord.findMany({
        where: { groupId, completedAt: { gte: since }, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 40,
      }),
      contextService.build(groupId),
      prisma.escalation.count({ where: { groupId, status: "pending" } }),
    ]);

    const unanswered = context.recentMessages
      .filter((m) => m.text.includes("?") && !/sentry|tgemployee/i.test(m.from))
      .slice(-5);

    const handled = actions
      .slice(0, 12)
      .map((a) => `• ${PRICING_LABELS[a.type] ?? a.type}`)
      .join("\n");

    const brief = [
      `Shift handover — ${group.name ?? group.telegramId}`,
      "",
      "Handled:",
      handled || "• (quiet shift)",
      "",
      `Pending escalations: ${pendingEscalations}`,
      "",
      "Possibly unanswered:",
      unanswered.length
        ? unanswered.map((m) => `• ${m.from}: ${m.text.slice(0, 120)}`).join("\n")
        : "• None spotted in recent context",
      "",
      "Needs human:",
      pendingEscalations > 0
        ? "• Review pending escalation drafts in Telegram DM"
        : "• No blocking items — optional skim of the group is enough",
    ].join("\n");

    const employerId = group.employment[0]?.userId ?? null;
    await prisma.report.create({
      data: {
        groupId,
        userId: employerId,
        content: brief,
        kind: "shift",
      },
    });

    if (employerId) {
      await actionService.record({
        type: "shift_handover",
        groupId,
        userId: employerId,
        billable: true,
        metadata: { pendingEscalations, actions: actions.length },
      });
    }

    const bot = getBot();
    for (const link of group.employment) {
      const tgId = link.user.settings?.telegramUserId;
      if (!tgId) continue;
      await bot.telegram.sendMessage(Number(tgId), brief).catch(() => undefined);
    }

    return brief;
  }

  async runWithSummaries(hourUtc: number) {
    const groups = await prisma.groupSettings.findMany({
      where: { enabled: true, dailySummaryHour: hourUtc, shiftHandover: true },
      select: { groupId: true },
    });
    for (const g of groups) {
      try {
        await this.generateShiftHandover(g.groupId);
      } catch (err) {
        console.error("[handover]", g.groupId, err);
      }
    }
  }
}

export const handoverService = new HandoverService();
