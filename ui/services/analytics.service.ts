import { prisma } from "@/lib/prisma";

export type AnalyticsOverview = {
  generatedAt: string;
  users: {
    total: number;
    withActiveEmployment: number;
    withWallet: number;
    withTelegramLinked: number;
  };
  groups: {
    total: number;
    enabledLinks: number;
  };
  actions: {
    last24h: number;
    last7d: number;
    last30d: number;
    byTypeLast7d: Array<{ type: string; count: number }>;
  };
  billing: {
    chargesLast7d: number;
    chargeAmountLast7d: number;
    settlementsLast30d: number;
  };
  rewards: {
    accounts: number;
    activeAccounts: number;
  };
  agentApi: {
    keysActive: number;
    tasksLast7d: number;
  };
};

export class AnalyticsService {
  async overview(): Promise<AnalyticsOverview> {
    const now = new Date();
    const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeEmployment,
      withWallet,
      withTelegramLinked,
      totalGroups,
      enabledLinks,
      actions24h,
      actions7d,
      actions30d,
      actionsByType,
      charges7d,
      chargeAgg,
      settlements30d,
      rewardAccounts,
      activeRewardAccounts,
      keysActive,
      agentTasks7d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.employment.count({ where: { status: "Active" } }),
      prisma.wallet.count(),
      prisma.settings.count({
        where: { telegramUserId: { not: null } },
      }),
      prisma.telegramGroup.count(),
      prisma.groupEmployment.count({ where: { enabled: true } }),
      prisma.actionRecord.count({ where: { completedAt: { gte: d1 } } }),
      prisma.actionRecord.count({ where: { completedAt: { gte: d7 } } }),
      prisma.actionRecord.count({ where: { completedAt: { gte: d30 } } }),
      prisma.actionRecord.groupBy({
        by: ["type"],
        where: { completedAt: { gte: d7 } },
        _count: { _all: true },
        orderBy: { _count: { type: "desc" } },
        take: 20,
      }),
      prisma.chargeRecord.count({ where: { createdAt: { gte: d7 } } }),
      prisma.chargeRecord.aggregate({
        where: { createdAt: { gte: d7 } },
        _sum: { amount: true },
      }),
      prisma.settlement.count({ where: { createdAt: { gte: d30 } } }),
      prisma.rewardAccount.count(),
      prisma.rewardAccount.count({ where: { status: "Active" } }),
      prisma.agentApiKey.count({ where: { revokedAt: null } }),
      prisma.actionRecord.count({
        where: { type: "agent_task", completedAt: { gte: d7 } },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        withActiveEmployment: activeEmployment,
        withWallet,
        withTelegramLinked,
      },
      groups: {
        total: totalGroups,
        enabledLinks,
      },
      actions: {
        last24h: actions24h,
        last7d: actions7d,
        last30d: actions30d,
        byTypeLast7d: actionsByType.map((row) => ({
          type: row.type,
          count: row._count._all,
        })),
      },
      billing: {
        chargesLast7d: charges7d,
        chargeAmountLast7d: Number(chargeAgg._sum.amount ?? 0),
        settlementsLast30d: settlements30d,
      },
      rewards: {
        accounts: rewardAccounts,
        activeAccounts: activeRewardAccounts,
      },
      agentApi: {
        keysActive,
        tasksLast7d: agentTasks7d,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
