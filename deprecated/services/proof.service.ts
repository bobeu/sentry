import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { getBot } from "@/services/telegram.service";
import { PRICING_LABELS } from "@/lib/pricing";

export class ProofService {
  async buildWeekly(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [actions, spend, groups] = await Promise.all([
      prisma.actionRecord.findMany({
        where: { userId, completedAt: { gte: since }, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 200,
      }),
      billingService.getSpending(userId).catch(() => null),
      prisma.groupEmployment.findMany({
        where: { userId, enabled: true },
        include: { group: { select: { name: true, telegramId: true } } },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const a of actions) {
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }

    const lines = Object.entries(byType)
      .map(([type, n]) => `• ${PRICING_LABELS[type as keyof typeof PRICING_LABELS] ?? type}: ${n}`)
      .join("\n");

    const content = [
      "Sentry proof-of-work (7 days)",
      "",
      `Actions completed: ${actions.length}`,
      `Groups enabled: ${groups.length}`,
      spend
        ? `Spend (period ledger): today ${spend.todaySpend} · lifetime ${spend.lifetimeSpend}`
        : "Spend: (unavailable)",
      "",
      "Breakdown:",
      lines || "• (none)",
      "",
      "Groups:",
      groups.map((g) => `• ${g.group.name ?? g.group.telegramId}`).join("\n") ||
        "• (none)",
    ].join("\n");

    return { content, actions: actions.length, byType, groups: groups.length };
  }

  async publishWeeklyForUser(userId: string) {
    const settings = await prisma.settings.findFirst({ where: { userId } });
    const links = await prisma.groupEmployment.findMany({
      where: { userId, enabled: true },
      include: { group: { include: { settings: true } } },
    });
    const anyProof = links.some((l) => l.group.settings?.proofOfWork !== false);
    if (!anyProof) return null;

    const report = await this.buildWeekly(userId);
    await prisma.report.create({
      data: { userId, content: report.content, kind: "proof" },
    });
    await actionService.record({
      type: "proof_report",
      userId,
      billable: true,
      metadata: { actions: report.actions, groups: report.groups },
    });

    if (settings?.telegramUserId) {
      const bot = getBot();
      await bot.telegram
        .sendMessage(Number(settings.telegramUserId), report.content)
        .catch(() => undefined);
    }

    return report;
  }

  async runWeeklyPass() {
    const employers = await prisma.groupEmployment.findMany({
      where: { enabled: true },
      select: { userId: true },
      distinct: ["userId"],
    });
    for (const e of employers) {
      try {
        await this.publishWeeklyForUser(e.userId);
      } catch (err) {
        console.error("[proof]", e.userId, err);
      }
    }
  }
}

export const proofService = new ProofService();
