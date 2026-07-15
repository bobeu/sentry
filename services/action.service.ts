import { prisma } from "@/lib/prisma";
import type { ActionType, ActionStatus, Prisma } from "@prisma/client";
import { billingService } from "@/services/billing.service";

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
        await billingService.chargeUser(action.id);
      } catch (err) {
        console.warn("[action] billing failed", action.id, err);
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

    const [actionsCompleted, billableToday, recent, groups, spending] = await Promise.all([
      prisma.actionRecord.count({ where: { userId, status: "completed" } }),
      prisma.actionRecord.count({
        where: {
          userId,
          billable: true,
          status: "completed",
          completedAt: { gte: startOfDay },
        },
      }),
      this.recentForUser(userId, 12),
      prisma.groupEmployment.count({ where: { userId, enabled: true } }),
      billingService.getSpending(userId),
    ]);

    return {
      actionsCompleted,
      billableToday,
      recent,
      groups,
      todaySpend: spending.todaySpend,
      balance: spending.balance,
      estimatedRemainingActions: spending.estimatedRemainingActions,
      spendSeries: spending.series,
    };
  }

  async groupStatsToday(groupId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const where = { groupId, completedAt: { gte: startOfDay }, status: "completed" as const };

    const [actionsToday, mentions, spam, summaries] = await Promise.all([
      prisma.actionRecord.count({ where }),
      prisma.actionRecord.count({ where: { ...where, type: "mention_reply" } }),
      prisma.actionRecord.count({ where: { ...where, type: "spam_moderation" } }),
      prisma.actionRecord.findFirst({
        where: { groupId, type: "daily_summary" },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    return {
      actionsToday,
      mentionsHandled: mentions,
      spamRemoved: spam,
      summaryStatus: summaries
        ? `Last summary ${summaries.completedAt.toISOString()}`
        : "No summary yet",
    };
  }
}

export const actionService = new ActionService();
