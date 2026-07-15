import { prisma } from "@/lib/prisma";
import type { EmploymentStatus } from "@prisma/client";
import { walletService } from "@/services/wallet.service";
import { actionService } from "@/services/action.service";
import { paymentService } from "@/services/payment.service";
import { logEvent } from "@/lib/logger";
import { Errors } from "@/lib/errors";

function balanceOf(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class EmploymentService {
  async getStatus(userId: string) {
    let employment = await prisma.employment.findUnique({ where: { userId } });
    const walletRow = await prisma.wallet.findUnique({ where: { userId } });
    const currency = await paymentService.getActiveCurrency();

    let walletBalance = balanceOf(walletRow?.balance);
    if (walletRow) {
      const synced = await walletService.syncBalanceFromChain(userId);
      walletBalance = synced?.balance ?? walletBalance;
    }

    if (employment?.status === "Active" && walletBalance <= 0) {
      employment = await prisma.employment.update({
        where: { userId },
        data: { status: "Exhausted" },
      });
    }

    const stats = await actionService.dashboardStats(userId);

    return {
      status: (employment?.status ?? "Inactive") as EmploymentStatus | "Inactive",
      employment: employment
        ? {
            id: employment.id,
            status: employment.status,
            startedAt: employment.startedAt,
            pausedAt: employment.pausedAt,
          }
        : null,
      wallet: walletRow
        ? {
            address: walletRow.address,
            balance: walletBalance,
            provider: walletRow.provider,
          }
        : null,
      currency,
      groupsConnected: stats.groupsConnected,
      groupsEnabled: stats.groupsEnabled,
      actionsCompletedToday: stats.actionsCompletedToday,
      actionsCompleted: stats.actionsCompleted,
      todaySpend: stats.todaySpend,
      lifetimeSpend: stats.lifetimeSpend,
      estimatedRemainingActions: stats.estimatedRemainingActions,
      spendSeries: stats.spendSeries,
      recentActivity: stats.recent,
    };
  }

  async start(userId: string, email?: string) {
    const wallet = await walletService.ensureSmartWallet(userId, email);
    const synced = await walletService.syncBalanceFromChain(userId);
    const bal = synced?.balance ?? wallet.balance;
    const nextStatus: EmploymentStatus = bal > 0 ? "Active" : "Inactive";

    const employment = await prisma.employment.upsert({
      where: { userId },
      create: {
        userId,
        status: nextStatus,
        startedAt: nextStatus === "Active" ? new Date() : null,
      },
      update: {
        status: nextStatus,
        startedAt: nextStatus === "Active" ? new Date() : undefined,
        pausedAt: null,
      },
    });

    logEvent("Employment Started", { userId, status: nextStatus });

    return {
      message:
        nextStatus === "Active"
          ? "Employment Active"
          : "Employment created. Send funds to your Sentry wallet to activate.",
      employment: {
        id: employment.id,
        status: employment.status,
        startedAt: employment.startedAt,
        pausedAt: employment.pausedAt,
      },
      wallet,
    };
  }

  async pause(userId: string) {
    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (!employment) throw new Error("No employment found. Hire Sentry first.");
    if (employment.status !== "Active") {
      throw new Error("Only Active employment can be paused");
    }

    const updated = await prisma.employment.update({
      where: { userId },
      data: { status: "Paused", pausedAt: new Date() },
    });

    logEvent("Employment Paused", { userId });
    return {
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt,
      pausedAt: updated.pausedAt,
    };
  }

  async resume(userId: string) {
    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (!employment) throw new Error("No employment found. Hire Sentry first.");
    if (employment.status !== "Paused") {
      throw new Error("Only Paused employment can be resumed");
    }

    const synced = await walletService.syncBalanceFromChain(userId);
    if (!synced || synced.balance <= 0) {
      const exhausted = await prisma.employment.update({
        where: { userId },
        data: { status: "Exhausted", pausedAt: null },
      });
      return {
        id: exhausted.id,
        status: exhausted.status,
        startedAt: exhausted.startedAt,
        pausedAt: exhausted.pausedAt,
      };
    }

    const updated = await prisma.employment.update({
      where: { userId },
      data: {
        status: "Active",
        pausedAt: null,
        startedAt: employment.startedAt ?? new Date(),
      },
    });

    logEvent("Employment Resumed", { userId });
    return {
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt,
      pausedAt: updated.pausedAt,
    };
  }

  async assertCanWork(userId: string) {
    const status = await this.getStatus(userId);
    if (status.status !== "Active") {
      throw Errors.employmentInactive();
    }
    return status;
  }
}

export const employmentService = new EmploymentService();
