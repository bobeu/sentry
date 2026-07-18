import { prisma } from "@/lib/prisma";
import type { ActionType, ActionStatus, Prisma } from "@/generated/prisma/client";
import { billingService } from "@/services/billing.service";
import { PRICING_LABELS } from "@/lib/pricing";

export class ActionService {
  async record(input: {
    type: ActionType;
    groupId?: string | null;
    userId?: string | null;
    billable?: boolean;
    status?: ActionStatus;
    metadata?: Prisma.InputJsonValue;
  }) {
    const action = await prisma.actionRecord.create({
      data: {
        type: input.type,
        groupId: input.groupId ?? null,
        userId: input.userId ?? null,
        billable: input.billable ?? true,
        status: input.status ?? "completed",
        metadata: input.metadata,
      },
    });

    if (action.status === "completed" && action.billable && action.userId) {
      try {
        await billingService.recordAction(action.id);
      } catch (err) {
        console.warn("[action] billing pending/failed", action.id, err);
      }
    }

    return action;
  }

  async listForUser(userId: string, take = 50) {
    return prisma.actionRecord.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take,
      include: { group: { select: { id: true, name: true, telegramId: true } } },
    });
  }

  async recentForUser(userId: string, take = 20) {
    return this.listForUser(userId, take);
  }

  async listForGroup(groupId: string, take = 50) {
    return prisma.actionRecord.findMany({
      where: { groupId },
      orderBy: { completedAt: "desc" },
      take,
    });
  }

  async dashboardStats(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [actionsCompleted, actionsCompletedToday, recent, groupsConnected, groupsEnabled, spending] =
      await Promise.all([
        prisma.actionRecord.count({ where: { userId, status: "completed" } }),
        prisma.actionRecord.count({
          where: {
            userId,
            status: "completed",
            completedAt: { gte: startOfDay },
          },
        }),
        this.recentForUser(userId, 12),
        prisma.groupEmployment.count({ where: { userId } }),
        prisma.groupEmployment.count({ where: { userId, enabled: true } }),
        billingService.getSpending(userId),
      ]);

    return {
      actionsCompleted,
      actionsCompletedToday,
      recent,
      groupsConnected,
      groupsEnabled,
      todaySpend: spending.todaySpend,
      lifetimeSpend: spending.lifetimeSpend,
      balance: spending.onChainBalance,
      availableBalance: spending.availableBalance,
      outstandingCharges: spending.outstandingCharges,
      estimatedRemainingActions: spending.estimatedRemainingActions,
      settlement: spending.settlement,
      spendSeries: spending.series,
    };
  }

  async groupStatsToday(groupId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const where = { groupId, completedAt: { gte: startOfDay }, status: "completed" as const };

    const [actionsToday, mentions, spam, summaries, spendAgg, recentMentions, moderationEvents] =
      await Promise.all([
        prisma.actionRecord.count({ where }),
        prisma.actionRecord.count({ where: { ...where, type: "mention_reply" } }),
        prisma.actionRecord.count({ where: { ...where, type: "spam_moderation" } }),
        prisma.actionRecord.findFirst({
          where: { groupId, type: "daily_summary" },
          orderBy: { completedAt: "desc" },
        }),
        prisma.chargeRecord.aggregate({
          where: {
            status: "succeeded",
            createdAt: { gte: startOfDay },
            actionRecord: { groupId },
          },
          _sum: { amount: true },
        }),
        prisma.actionRecord.findMany({
          where: { ...where, type: { in: ["mention_reply", "faq_answer"] } },
          orderBy: { completedAt: "desc" },
          take: 5,
        }),
        prisma.actionRecord.findMany({
          where: { ...where, type: "spam_moderation" },
          orderBy: { completedAt: "desc" },
          take: 5,
        }),
      ]);

    return {
      actionsToday,
      mentionsHandled: mentions,
      spamRemoved: spam,
      todaySpend: spendAgg._sum.amount ? Number(spendAgg._sum.amount.toString()) : 0,
      summaryStatus: summaries
        ? `Last summary ${summaries.completedAt.toISOString()}`
        : "No summary yet",
      recentMentions: recentMentions.map((a) => ({
        id: a.id,
        type: a.type,
        label: PRICING_LABELS[a.type],
        completedAt: a.completedAt,
      })),
      moderationEvents: moderationEvents.map((a) => ({
        id: a.id,
        label: PRICING_LABELS[a.type],
        completedAt: a.completedAt,
        metadata: a.metadata,
      })),
    };
  }
}

export const actionService = new ActionService();
