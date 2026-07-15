import { prisma } from "@/lib/prisma";
import type { EmploymentStatus } from "@prisma/client";

function balanceOf(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class EmploymentService {
  async getStatus(userId: string) {
    let employment = await prisma.employment.findUnique({ where: { userId } });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const groups = await prisma.telegramGroup.count();
    const tasks = await prisma.task.count({
      where: {
        OR: [{ groupId: null }, { group: { isNot: null } }],
      },
    });

    if (employment?.status === "Active" && balanceOf(wallet?.balance) <= 0) {
      employment = await prisma.employment.update({
        where: { userId },
        data: { status: "Exhausted" },
      });
    }

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
          }
        : null,
      groups: 0,
      tasks: 0,
      counts: { groups, tasks },
    };
  }

  async start(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new Error("Create or connect a wallet before hiring Sentry");
    }

    const bal = balanceOf(wallet.balance);
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
      data: {
        status: "Paused",
        pausedAt: new Date(),
      },
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
}

export const employmentService = new EmploymentService();
