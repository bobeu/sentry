import { prisma } from "@/lib/prisma";
import type { EmploymentStatus } from "@prisma/client";
import { walletService } from "@/services/wallet.service";
import { actionService } from "@/services/action.service";

function balanceOf(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class EmploymentService {
  async getStatus(userId: string) {
    let employment = await prisma.employment.findUnique({ where: { userId } });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (employment?.status === "Active" && balanceOf(wallet?.balance) <= 0) {
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
      wallet: wallet
        ? {
            address: wallet.address,
            balance: balanceOf(wallet.balance),
            provider: wallet.provider,
          }
        : null,
      groups: stats.groups,
      actionsCompleted: stats.actionsCompleted,
      billableToday: stats.billableToday,
      recentActivity: stats.recent,
    };
  }

  async start(userId: string) {
    const wallet = await walletService.ensureSmartWallet(userId);
    const bal = wallet.balance;
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

    return {
      message:
        nextStatus === "Active"
          ? "Employment Active"
          : "Employment created. Deposit funds to activate Sentry.",
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
    if (!employment) {
      throw new Error("No employment found. Hire Sentry first.");
    }
    if (employment.status !== "Active") {
      throw new Error("Only Active employment can be paused");
    }

    const updated = await prisma.employment.update({
      where: { userId },
      data: { status: "Paused", pausedAt: new Date() },
    });

    return {
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt,
      pausedAt: updated.pausedAt,
    };
  }

  async resume(userId: string) {
    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (!employment) {
      throw new Error("No employment found. Hire Sentry first.");
    }
    if (employment.status !== "Paused") {
      throw new Error("Only Paused employment can be resumed");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (balanceOf(wallet?.balance) <= 0) {
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
      throw new Error("Sentry employment is not Active");
    }
    return status;
  }
}

export const employmentService = new EmploymentService();
