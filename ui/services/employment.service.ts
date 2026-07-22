import { prisma } from "@/lib/prisma";
import type { ActionType, EmploymentStatus } from "@/generated/client";
import { walletService } from "@/services/wallet.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import type { PaymentCurrency } from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";
import { identityUserKey } from "@/lib/identity";
import { logEvent } from "@/lib/logger";
import { Errors } from "@/lib/errors";
import {
  EMPLOYMENT_AGREEMENT_TITLE,
  EMPLOYMENT_AGREEMENT_VERSION,
  getEmploymentAgreementText,
} from "@/lib/employment-agreement";

function balanceOf(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class EmploymentService {
  async getAgreement(userId: string) {
    const [user, employment] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      prisma.employment.findUnique({ where: { userId } }),
    ]);
    const text = getEmploymentAgreementText({
      employerEmail: user?.email,
    });
    const acceptedCurrent =
      employment?.agreementVersion === EMPLOYMENT_AGREEMENT_VERSION &&
      Boolean(employment.agreementAcceptedAt);

    return {
      title: EMPLOYMENT_AGREEMENT_TITLE,
      version: EMPLOYMENT_AGREEMENT_VERSION,
      text,
      acceptedCurrent,
      agreementVersion: employment?.agreementVersion ?? null,
      agreementAcceptedAt: employment?.agreementAcceptedAt?.toISOString() ?? null,
      agreementRejectedAt: employment?.agreementRejectedAt?.toISOString() ?? null,
    };
  }

  /**
   * Record rejection — no wallet provisioning, no Active employment from this attempt.
   */
  async rejectAgreement(userId: string) {
    const existing = await prisma.employment.findUnique({ where: { userId } });

    if (!existing) {
      await prisma.employment.create({
        data: {
          userId,
          status: "Inactive",
          agreementRejectedAt: new Date(),
        },
      });
    } else if (existing.status === "Active" || existing.status === "Paused") {
      // Declined a new hire/version offer without tearing down running employment.
      await prisma.employment.update({
        where: { userId },
        data: { agreementRejectedAt: new Date() },
      });
    } else {
      await prisma.employment.update({
        where: { userId },
        data: {
          status: "Inactive",
          agreementRejectedAt: new Date(),
          agreementAcceptedAt: null,
          agreementVersion: null,
          startedAt: null,
        },
      });
    }

    logEvent("Employment Agreement Rejected", {
      userId,
      version: EMPLOYMENT_AGREEMENT_VERSION,
    });

    return {
      rejected: true as const,
      version: EMPLOYMENT_AGREEMENT_VERSION,
      message:
        "Agreement rejected. No hire action was taken — employment did not proceed.",
    };
  }

  async acceptAgreement(userId: string, version: string) {
    if (version !== EMPLOYMENT_AGREEMENT_VERSION) {
      throw new Error(
        `Agreement version mismatch. Please review version ${EMPLOYMENT_AGREEMENT_VERSION}.`,
      );
    }
    const now = new Date();
    await prisma.employment.upsert({
      where: { userId },
      create: {
        userId,
        status: "Inactive",
        agreementVersion: version,
        agreementAcceptedAt: now,
        agreementRejectedAt: null,
      },
      update: {
        agreementVersion: version,
        agreementAcceptedAt: now,
        agreementRejectedAt: null,
      },
    });
    logEvent("Employment Agreement Accepted", { userId, version });
    return {
      accepted: true as const,
      version,
      acceptedAt: now.toISOString(),
    };
  }

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
    const agreement = await this.getAgreement(userId);

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
            agreementVersion: employment.agreementVersion,
            agreementAcceptedAt: employment.agreementAcceptedAt,
          }
        : null,
      agreement: {
        version: agreement.version,
        title: agreement.title,
        acceptedCurrent: agreement.acceptedCurrent,
        agreementAcceptedAt: agreement.agreementAcceptedAt,
      },
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

  async start(
    userId: string,
    email?: string,
    currency?: PaymentCurrency,
    options?: { agreementAccepted?: boolean; agreementVersion?: string },
  ) {
    const version = options?.agreementVersion ?? EMPLOYMENT_AGREEMENT_VERSION;
    if (!options?.agreementAccepted) {
      throw new Error(
        "You must accept the Sentry Employment Agreement before hiring. Rejecting cancels hire — no action is taken.",
      );
    }
    if (version !== EMPLOYMENT_AGREEMENT_VERSION) {
      throw new Error(
        `Please accept Employment Agreement version ${EMPLOYMENT_AGREEMENT_VERSION}.`,
      );
    }

    await this.acceptAgreement(userId, version);

    const wallet = await walletService.ensureSmartWallet(userId, email, currency);
    const ledger = await billingService.getBalanceLedger(userId);
    const nextStatus: EmploymentStatus =
      ledger.availableBalance > 0 ? "Active" : "Inactive";

    const employment = await prisma.employment.upsert({
      where: { userId },
      create: {
        userId,
        status: nextStatus,
        startedAt: nextStatus === "Active" ? new Date() : null,
        agreementVersion: version,
        agreementAcceptedAt: new Date(),
        agreementRejectedAt: null,
      },
      update: {
        status: nextStatus,
        startedAt: nextStatus === "Active" ? new Date() : undefined,
        pausedAt: null,
        agreementVersion: version,
        agreementAcceptedAt: new Date(),
        agreementRejectedAt: null,
      },
    });

    logEvent("Employment Started", {
      userId,
      status: nextStatus,
      agreementVersion: version,
    });

    // Best-effort: DM the agreement confirmation if Telegram is linked.
    try {
      const settings = await prisma.settings.findUnique({ where: { userId } });
      if (settings?.telegramUserId) {
        const { getBot } = await import("@/services/telegram.service");
        const { agreementChunksForTelegram, getEmploymentAgreementText } =
          await import("@/lib/employment-agreement");
        const bot = getBot();
        const full = getEmploymentAgreementText({ employerEmail: email });
        await bot.telegram
          .sendMessage(
            Number(settings.telegramUserId),
            `Employment Agreement v${version} accepted. Hire is proceeding.\n\nYou can re-read anytime with /agreement or Menu → Agreement.`,
          )
          .catch(() => undefined);
        for (const chunk of agreementChunksForTelegram(full).slice(0, 4)) {
          await bot.telegram
            .sendMessage(Number(settings.telegramUserId), chunk)
            .catch(() => undefined);
        }
      }
    } catch (err) {
      console.warn("[employment:dm-agreement]", err);
    }

    return {
      message:
        nextStatus === "Active"
          ? "Employment Active — Agreement accepted."
          : "Employment created under the accepted Agreement. Send funds to your Sentry wallet to activate.",
      employment: {
        id: employment.id,
        status: employment.status,
        startedAt: employment.startedAt,
        pausedAt: employment.pausedAt,
        agreementVersion: employment.agreementVersion,
        agreementAcceptedAt: employment.agreementAcceptedAt,
      },
      wallet,
      agreementVersion: version,
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

  async assertCanWork(userId: string, actionType?: ActionType) {
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
