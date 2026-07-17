import { prisma } from "@/lib/prisma";
import type { EmploymentStatus } from "@/generated";
import { walletService } from "@/services/wallet.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import type { PaymentCurrency } from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";
import { identityUserKey } from "@/lib/identity";
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
    const ledger = await billingService.getBalanceLedger(userId);
    const currency = ledger.currency;
    const settlement = await billingService.getSettlementStatus(userId);

    if (employment?.status === "Active" && ledger.availableBalance <= 0) {
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
            outstandingCharges: balanceOf(employment.outstandingCharges),
            lastSettlementAt: employment.lastSettlementAt,
          }
        : null,
      wallet: walletRow
        ? {
            address: walletRow.address,
            balance: ledger.onChainBalance,
            availableBalance: ledger.availableBalance,
            outstandingCharges: ledger.outstandingCharges,
            withdrawableBalance: ledger.withdrawableBalance,
            provider: walletRow.provider,
          }
        : null,
      currency,
      groupsEnabled: stats.groupsEnabled,
      actionsCompleted: stats.actionsCompleted,
      todaySpend: stats.todaySpend,
      lifetimeSpend: stats.lifetimeSpend,
      outstandingCharges: ledger.outstandingCharges,
      availableBalance: ledger.availableBalance,
      lastSettlementAt: settlement.lastSettlementAt,
      nextSettlement: settlement.nextSettlement,
      recentActivity: stats.recent,
    };
  }

  async start(userId: string, email?: string, currency?: PaymentCurrency) {
    const wallet = await walletService.ensureSmartWallet(userId, email, currency);
    const ledger = await billingService.getBalanceLedger(userId);
    const nextStatus: EmploymentStatus = ledger.availableBalance > 0 ? "Active" : "Inactive";

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
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet?.identityHash && blockchainService.isConfigured()) {
      await blockchainService.pauseOnChain(
        identityUserKey(wallet.identityHash as `0x${string}`),
      );
    }

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

    const ledger = await billingService.getBalanceLedger(userId);
    if (ledger.availableBalance <= 0) {
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
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet?.identityHash && blockchainService.isConfigured()) {
      await blockchainService.resumeOnChain(
        identityUserKey(wallet.identityHash as `0x${string}`),
      );
    }

    logEvent("Employment Resumed", { userId });
    return {
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt,
      pausedAt: updated.pausedAt,
    };
  }

  async assertCanWork(userId: string, actionType?: import("@prisma/client").ActionType) {
    const status = await this.getStatus(userId);
    if (status.status !== "Active") {
      throw Errors.employmentInactive();
    }
    const canWork = await billingService.canPerformAction(
      userId,
      actionType ?? undefined,
    );
    if (!canWork) {
      await billingService.exhaustUser(userId, "insufficient_available_balance");
      throw Errors.walletNotFunded();
    }
    return status;
  }
}

export const employmentService = new EmploymentService();
