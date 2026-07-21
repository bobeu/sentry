import { prisma } from "@/lib/prisma";
import type { ActionType } from "@/generated/client";
import { averageActionCost, priceFor, PRICING_LABELS } from "@/lib/pricing";
import { blockchainService } from "@/services/blockchain.service";
import { paymentService } from "@/services/payment.service";
import { keccak256, toBytes, type Hex } from "viem";
import { Errors } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { formatAmount, type PaymentCurrency } from "@/lib/payment-currency";
import { identityUserKey } from "@/lib/identity";
import { isFiniteBalance, toWalletBalance } from "@/lib/wallet-balance";
import {
  getSettlementConfig,
  settlementIntervalMs,
  bufferedSettlementFee,
  type SettlementConfig,
} from "@/lib/settlement-config";

function bal(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

const TX_OPTS = { maxWait: 20_000, timeout: 60_000 } as const;

/** Serialize settlements per user so concurrent actions don't contend on DB txs. */
const settlementInflight = new Map<string, Promise<unknown>>();

export type BalanceLedger = {
  onChainBalance: number;
  outstandingCharges: number;
  availableBalance: number;
  withdrawableBalance: number;
  currency: PaymentCurrency;
};

export class BillingService {
  async getPricing() {
    const currency = await paymentService.getDefaultCurrency();
    const { getPricing } = await import("@/lib/pricing");
    return getPricing(currency);
  }

  calculateCharge(type: ActionType) {
    return priceFor(type);
  }

  estimateSettlementFee() {
    return bufferedSettlementFee();
  }

  /**
   * Resolve fee to deduct with the action: configured buffer, optionally raised
   * from live Celo gas when SETTLEMENT_ESTIMATE_GAS is enabled and currency is CELO.
   */
  async resolveSettlementFee(input: {
    currency: PaymentCurrency;
    userKey: Hex;
    serviceAmount: number;
    settlementId: Hex;
  }): Promise<number> {
    const config = getSettlementConfig();
    let fee = bufferedSettlementFee(config);

    if (
      config.estimateGasOnChain &&
      input.currency === "CELO" &&
      blockchainService.isConfigured()
    ) {
      const estimated = await blockchainService.estimateChargeSettlementFeeCelo({
        userKey: input.userKey,
        currency: input.currency,
        serviceAmount: Math.max(input.serviceAmount, 0.000001),
        settlementFee: Math.max(fee, 0.000001),
        settlementId: input.settlementId,
      });
      if (estimated != null && estimated > fee) {
        fee = estimated;
      }
    }

    return fee;
  }

  calculateOutstanding(userId: string) {
    return prisma.employment
      .findUnique({ where: { userId } })
      .then((e) => bal(e?.outstandingCharges));
  }

  async syncOnChainBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return 0;

    let balance = bal(wallet.balance);
    if (blockchainService.isConfigured()) {
      const chainBal = await blockchainService.syncBalanceCache(
        wallet.address as `0x${string}`,
        wallet.walletCurrency as PaymentCurrency,
      );
      if (isFiniteBalance(chainBal)) {
        balance = chainBal;
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: toWalletBalance(chainBal), balanceCachedAt: new Date() },
        });
      }
    }
    return balance;
  }

  async getBalanceLedger(userId: string): Promise<BalanceLedger> {
    const [onChainBalance, employment, wallet] = await Promise.all([
      this.syncOnChainBalance(userId),
      prisma.employment.findUnique({ where: { userId } }),
      prisma.wallet.findUnique({ where: { userId } }),
    ]);
    const currency =
      (wallet?.walletCurrency as PaymentCurrency | undefined) ??
      (await paymentService.getDefaultCurrency());
    const outstandingCharges = bal(employment?.outstandingCharges);
    const availableBalance = Math.max(0, onChainBalance - outstandingCharges);
    const feeReserve = outstandingCharges > 0 ? this.estimateSettlementFee() : 0;
    return {
      onChainBalance,
      outstandingCharges,
      availableBalance,
      withdrawableBalance: Math.max(0, availableBalance - feeReserve),
      currency,
    };
  }

  async canPerformAction(userId: string, actionType?: ActionType) {
    const ledger = await this.getBalanceLedger(userId);
    const cost = actionType ? this.calculateCharge(actionType) : averageActionCost();
    const fee =
      getSettlementConfig().mode === "instant" ? this.estimateSettlementFee() : 0;
    return ledger.availableBalance >= cost + fee;
  }

  async getSettlementStatus(userId: string) {
    const config = getSettlementConfig();
    const employment = await prisma.employment.findUnique({ where: { userId } });
    const outstanding = bal(employment?.outstandingCharges);
    const unsettledCount = await prisma.chargeRecord.count({
      where: {
        status: "pending",
        actionRecord: { userId, settlementId: null },
      },
    });

    const lastSettlement = await prisma.settlement.findFirst({
      where: { userId, status: "succeeded" },
      orderBy: { completedAt: "desc" },
    });

    const failedSettlement = await prisma.settlement.findFirst({
      where: { userId, status: "failed" },
      orderBy: { createdAt: "desc" },
    });

    const lastAt = employment?.lastSettlementAt ?? lastSettlement?.completedAt ?? null;
    const elapsed = lastAt ? Date.now() - lastAt.getTime() : settlementIntervalMs(config);
    const timeUntilMs = Math.max(0, settlementIntervalMs(config) - elapsed);

    const triggers = {
      monetary: outstanding >= config.monetaryThreshold,
      actions: unsettledCount >= config.actionThreshold,
      time: elapsed >= settlementIntervalMs(config),
      instant: config.mode === "instant" && outstanding > 0,
    };

    return {
      config,
      mode: config.mode,
      outstandingCharges: outstanding,
      unsettledActionCount: unsettledCount,
      lastSettlementAt: lastAt,
      lastSettlement,
      failedSettlement,
      nextSettlement: {
        monetaryRemaining: Math.max(0, config.monetaryThreshold - outstanding),
        actionsRemaining: Math.max(0, config.actionThreshold - unsettledCount),
        timeRemainingMs: timeUntilMs,
        triggers,
      },
    };
  }

  private shouldSettle(
    outstanding: number,
    unsettledCount: number,
    lastSettlementAt: Date | null | undefined,
    config: SettlementConfig,
  ) {
    if (outstanding <= 0) return false;
    if (config.mode === "instant") return true;
    const elapsed = lastSettlementAt
      ? Date.now() - lastSettlementAt.getTime()
      : settlementIntervalMs(config);
    return (
      outstanding >= config.monetaryThreshold ||
      unsettledCount >= config.actionThreshold ||
      elapsed >= settlementIntervalMs(config)
    );
  }

  async getSpending(userId: string) {
    const ledger = await this.getBalanceLedger(userId);
    const settlementStatus = await this.getSettlementStatus(userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayAgg, lifetimeAgg, recentCharges, recentSettlements] = await Promise.all([
      prisma.chargeRecord.aggregate({
        where: {
          createdAt: { gte: startOfDay },
          actionRecord: { userId },
        },
        _sum: { amount: true },
      }),
      prisma.settlement.aggregate({
        where: { userId, status: "succeeded" },
        _sum: { amount: true },
      }),
      prisma.chargeRecord.findMany({
        where: { actionRecord: { userId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actionRecord: true },
      }),
      prisma.settlement.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const todaySpend = bal(todayAgg._sum.amount);
    const lifetimeSpend = bal(lifetimeAgg._sum.amount);
    const avg = averageActionCost();
    const estimatedRemaining = avg > 0 ? Math.floor(ledger.availableBalance / avg) : 0;

    const series = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const agg = await prisma.chargeRecord.aggregate({
        where: {
          createdAt: { gte: day, lt: next },
          actionRecord: { userId },
        },
        _sum: { amount: true },
      });
      series.push({ date: day.toISOString().slice(0, 10), spend: bal(agg._sum.amount) });
    }

    return {
      ...ledger,
      balance: ledger.onChainBalance,
      todaySpend,
      lifetimeSpend,
      estimatedRemainingActions: estimatedRemaining,
      averageActionCost: avg,
      settlement: settlementStatus,
      recentCharges: recentCharges.map((c) => ({
        id: c.id,
        amount: bal(c.amount),
        currency: c.currency,
        status: c.status,
        transactionHash: c.transactionHash,
        createdAt: c.createdAt,
        label: PRICING_LABELS[c.actionRecord.type],
        type: c.actionRecord.type,
      })),
      recentSettlements: recentSettlements.map((s) => ({
        id: s.id,
        amount: bal(s.amount),
        settlementFee: bal(s.settlementFee),
        currency: s.currency,
        actionCount: s.actionCount,
        status: s.status,
        transactionHash: s.transactionHash,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
      series,
    };
  }

  async getHistory(userId: string, take = 50) {
    const [settlements, outstanding, withdrawals] = await Promise.all([
      prisma.settlement.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.chargeRecord.findMany({
        where: {
          status: "pending",
          actionRecord: { userId, settlementId: null },
        },
        orderBy: { createdAt: "desc" },
        take,
        include: { actionRecord: { include: { group: true } } },
      }),
      prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    return {
      settlements: settlements.map((s) => ({
        id: s.id,
        amount: bal(s.amount),
        settlementFee: bal(s.settlementFee),
        totalSettled: bal(s.amount) + bal(s.settlementFee),
        currency: s.currency,
        actionCount: s.actionCount,
        status: s.status,
        transactionHash: s.transactionHash,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
      outstanding: outstanding.map((c) => ({
        id: c.id,
        amount: bal(c.amount),
        currency: c.currency,
        status: c.status,
        createdAt: c.createdAt,
        label: PRICING_LABELS[c.actionRecord.type],
        type: c.actionRecord.type,
        groupName: c.actionRecord.group?.name ?? null,
      })),
      withdrawals: withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        amount: bal(withdrawal.amount),
        currency: withdrawal.currency,
        destination: withdrawal.destination,
        status: withdrawal.status,
        transactionHash: withdrawal.transactionHash,
        createdAt: withdrawal.createdAt,
        completedAt: withdrawal.completedAt,
      })),
    };
  }

  /** Record completed work — increases outstanding charges, then settle per mode. */
  async recordAction(actionRecordId: string) {
    const action = await prisma.actionRecord.findUnique({
      where: { id: actionRecordId },
      include: { charge: true, user: { include: { wallet: true, employment: true } } },
    });

    if (!action) throw new Error("ActionRecord not found");
    if (action.charge) return action.charge;
    if (action.status !== "completed" || !action.billable) return null;
    if (!action.userId || !action.user?.wallet) return null;

    const amount = this.calculateCharge(action.type);
    if (amount <= 0) return null;

    const currency = action.user.wallet.walletCurrency as PaymentCurrency;
    const config = getSettlementConfig();
    const feeReserve =
      config.mode === "instant" ? this.estimateSettlementFee() : 0;

    const ledgerBefore = await this.getBalanceLedger(action.userId);
    if (ledgerBefore.availableBalance < amount + feeReserve) {
      await this.exhaustUser(action.userId, "insufficient_available_balance");
      throw Errors.walletNotFunded();
    }

    const charge = await prisma.$transaction(async (tx) => {
      const pending = await tx.chargeRecord.create({
        data: {
          actionRecordId: action.id,
          amount,
          currency,
          status: "pending",
        },
      });

      await tx.employment.upsert({
        where: { userId: action.userId! },
        create: {
          userId: action.userId!,
          status: "Active",
          outstandingCharges: amount,
        },
        update: {
          outstandingCharges: { increment: amount },
        },
      });

      return pending;
    }, TX_OPTS);

    logEvent("Action Recorded", {
      actionId: action.id,
      amount,
      currency,
      status: "outstanding",
      mode: config.mode,
    });

    const ledgerAfter = await this.getBalanceLedger(action.userId);
    if (ledgerAfter.outstandingCharges >= config.monetaryThreshold * 0.8) {
      await this.notify(
        action.userId,
        `Outstanding charges: ${formatAmount(ledgerAfter.outstandingCharges, currency)} pending settlement.`,
      );
    }

    if (ledgerAfter.availableBalance <= 0) {
      await this.exhaustUser(action.userId, "available_balance_exhausted");
    } else if (ledgerAfter.availableBalance / (ledgerAfter.onChainBalance || 1) < 0.2) {
      await this.notify(
        action.userId,
        `Available balance low (<20%): ${formatAmount(ledgerAfter.availableBalance, currency)} remaining.`,
      );
    }

    try {
      if (config.mode === "instant") {
        await this.settleEmployment(action.userId);
      } else {
        await this.maybeSettle(action.userId);
      }
    } catch (err) {
      console.warn("[billing] settlement deferred", action.userId, err);
    }

    return charge;
  }

  private async maybeSettle(userId: string) {
    const employment = await prisma.employment.findUnique({ where: { userId } });
    const outstanding = bal(employment?.outstandingCharges);
    const unsettledCount = await prisma.chargeRecord.count({
      where: { status: "pending", actionRecord: { userId, settlementId: null } },
    });
    if (
      this.shouldSettle(
        outstanding,
        unsettledCount,
        employment?.lastSettlementAt,
        getSettlementConfig(),
      )
    ) {
      await this.settleEmployment(userId);
    }
  }

  async settleEmployment(userId: string) {
    const prev = settlementInflight.get(userId) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(() => this.settleEmploymentInner(userId));
    settlementInflight.set(
      userId,
      run.finally(() => {
        if (settlementInflight.get(userId) === run) {
          settlementInflight.delete(userId);
        }
      }),
    );
    return run;
  }

  private async settleEmploymentInner(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (!wallet || !employment) return null;
    if (!wallet.identityHash) {
      throw new Error("Wallet identity is missing");
    }

    const inFlight = await prisma.settlement.findFirst({
      where: { userId, status: { in: ["pending", "submitted"] } },
      orderBy: { createdAt: "desc" },
    });
    if (inFlight) {
      const ageMs = Date.now() - inFlight.createdAt.getTime();
      if (ageMs < 5 * 60 * 1000) {
        console.warn("[billing] settlement already in flight", inFlight.id);
        return inFlight;
      }
      await prisma.settlement.update({
        where: { id: inFlight.id },
        data: {
          status: "failed",
          failureReason: "stale_in_flight_settlement",
        },
      });
    }

    const pendingCharges = await prisma.chargeRecord.findMany({
      where: {
        status: "pending",
        actionRecord: { userId, settlementId: null },
      },
      include: { actionRecord: true },
      orderBy: { createdAt: "asc" },
    });
    if (pendingCharges.length === 0) return null;

    const serviceAmount = pendingCharges.reduce((sum, c) => sum + bal(c.amount), 0);
    const currency = wallet.walletCurrency as PaymentCurrency;
    const userKey = identityUserKey(wallet.identityHash as `0x${string}`);
    const settlementIdPreview = keccak256(toBytes(`preview:${userId}:${Date.now()}`));

    const settlementFee = await this.resolveSettlementFee({
      currency,
      userKey,
      serviceAmount,
      settlementId: settlementIdPreview,
    });
    const totalAmount = serviceAmount + settlementFee;

    const settlement = await prisma.settlement.create({
      data: {
        userId,
        walletId: wallet.id,
        amount: serviceAmount,
        settlementFee,
        currency,
        actionCount: pendingCharges.length,
        status: "pending",
      },
    });

    if (!blockchainService.isConfigured()) {
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: {
          status: "failed",
          failureReason: "Blockchain not configured",
        },
      });
      logEvent("Settlement Failed", {
        settlementId: settlement.id,
        reason: "blockchain_unavailable",
      });
      return settlement;
    }

    const onChainBalance = await this.syncOnChainBalance(userId);
    if (onChainBalance < totalAmount) {
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: {
          status: "failed",
          failureReason: "Insufficient on-chain balance for settlement",
        },
      });
      await this.exhaustUser(userId, "insufficient_balance_for_settlement");
      return settlement;
    }

    const settlementHash = keccak256(toBytes(settlement.id));

    try {
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: { status: "submitted" },
      });

      const txHash = await blockchainService.chargeSettlementOnChain({
        userKey,
        currency,
        serviceAmount,
        settlementFee,
        settlementId: settlementHash,
      });

      const syncedBal = await blockchainService.syncBalanceCache(
        wallet.address as `0x${string}`,
        currency,
      );
      const newBal = isFiniteBalance(syncedBal)
        ? syncedBal
        : onChainBalance - totalAmount;
      if (!isFiniteBalance(newBal)) {
        throw new Error("Could not determine post-settlement wallet balance");
      }

      await this.applySettlementSuccess({
        settlementId: settlement.id,
        userId,
        walletId: wallet.id,
        chargeIds: pendingCharges.map((c) => c.id),
        actionIds: pendingCharges.map((c) => c.actionRecordId),
        txHash,
        newBal,
      });

      logEvent("Settlement Completed", {
        settlementId: settlement.id,
        txHash,
        serviceAmount,
        settlementFee,
        currency,
        actionCount: pendingCharges.length,
        mode: getSettlementConfig().mode,
      });

      if (getSettlementConfig().mode === "batch" || pendingCharges.length > 1) {
        await this.notify(
          userId,
          `Settlement complete: ${formatAmount(serviceAmount, currency)} + ${formatAmount(settlementFee, currency)} fee (${pendingCharges.length} actions).`,
        );
      }

      const ledger = await this.getBalanceLedger(userId);
      if (ledger.availableBalance <= 0 && ledger.onChainBalance <= 0) {
        await this.exhaustUser(userId, "balance_zero_after_settlement");
      }

      return settlement;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "settlement_failed";
      await prisma.settlement
        .update({
          where: { id: settlement.id },
          data: { status: "failed", failureReason: reason.slice(0, 500) },
        })
        .catch((updateErr) => {
          console.error("[billing] failed to mark settlement failed", updateErr);
        });
      logEvent("Settlement Failed", { settlementId: settlement.id, reason });
      await this.notify(
        userId,
        `Settlement failed (${reason}). Outstanding charges preserved — will retry automatically.`,
      );
      throw Errors.chargeFailed(reason);
    }
  }

  /**
   * Persist settlement success without a long interactive multi-statement transaction
   * (avoids "Unable to start a transaction in the given time" after chain latency).
   */
  private async applySettlementSuccess(input: {
    settlementId: string;
    userId: string;
    walletId: string;
    chargeIds: string[];
    actionIds: string[];
    txHash: string;
    newBal: number;
  }) {
    const write = async () => {
      await prisma.settlement.update({
        where: { id: input.settlementId },
        data: {
          status: "succeeded",
          transactionHash: input.txHash,
          completedAt: new Date(),
        },
      });
      await prisma.chargeRecord.updateMany({
        where: { id: { in: input.chargeIds } },
        data: { status: "succeeded", transactionHash: input.txHash },
      });
      await prisma.actionRecord.updateMany({
        where: { id: { in: input.actionIds } },
        data: { settlementId: input.settlementId },
      });
      const remaining = await prisma.chargeRecord.aggregate({
        where: {
          status: "pending",
          actionRecord: { userId: input.userId, settlementId: null },
        },
        _sum: { amount: true },
      });
      await prisma.employment.update({
        where: { userId: input.userId },
        data: {
          outstandingCharges: bal(remaining._sum.amount),
          lastSettlementAt: new Date(),
        },
      });
      await prisma.wallet.update({
        where: { id: input.walletId },
        data: {
          balance: toWalletBalance(input.newBal),
          balanceCachedAt: new Date(),
        },
      });
    };

    try {
      await write();
    } catch (err) {
      console.warn("[billing] settlement persist retry", err);
      await new Promise((r) => setTimeout(r, 500));
      await write();
    }
  }

  async retrySettlement(settlementId: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { actions: { include: { charge: true } } },
    });
    if (!settlement || settlement.status !== "failed") {
      throw new Error("Settlement not retryable");
    }

    const userId = settlement.userId;
    const pendingCharges = await prisma.chargeRecord.findMany({
      where: {
        status: "pending",
        actionRecord: { userId, settlementId: null },
      },
    });
    if (pendingCharges.length === 0) return null;

    return this.settleEmployment(userId);
  }

  async evaluateSettlements() {
    const employments = await prisma.employment.findMany({
      where: { outstandingCharges: { gt: 0 } },
    });

    let settled = 0;
    let retried = 0;
    const config = getSettlementConfig();

    for (const employment of employments) {
      try {
        const outstanding = bal(employment.outstandingCharges);
        const unsettledCount = await prisma.chargeRecord.count({
          where: {
            status: "pending",
            actionRecord: { userId: employment.userId, settlementId: null },
          },
        });
        if (
          this.shouldSettle(
            outstanding,
            unsettledCount,
            employment.lastSettlementAt,
            config,
          )
        ) {
          await this.settleEmployment(employment.userId);
          settled++;
        }
      } catch (err) {
        console.warn("[billing] settlement evaluation", employment.userId, err);
      }
    }

    const failed = await prisma.settlement.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const s of failed) {
      try {
        await this.retrySettlement(s.id);
        retried++;
      } catch {
        // preserve outstanding for next pass
      }
    }

    return { settled, retried, evaluated: employments.length, mode: config.mode };
  }

  async refund(chargeId: string) {
    const charge = await prisma.chargeRecord.findUnique({
      where: { id: chargeId },
      include: { actionRecord: true },
    });
    if (!charge || charge.status !== "succeeded") {
      throw new Error("Charge not refundable");
    }
    await prisma.chargeRecord.update({
      where: { id: chargeId },
      data: { status: "refunded" },
    });
    return { ok: true };
  }

  async exhaustUser(userId: string, reason: string) {
    await prisma.employment.updateMany({
      where: { userId },
      data: { status: "Exhausted", pausedAt: new Date() },
    });

    const links = await prisma.groupEmployment.findMany({
      where: { userId, enabled: true },
    });
    for (const link of links) {
      await prisma.groupSettings.updateMany({
        where: { groupId: link.groupId },
        data: { enabled: false },
      });
    }

    logEvent("Employment Exhausted", { userId, reason });
    await this.notify(
      userId,
      `Employment exhausted (${reason}). Sentry stopped working. Deposit funds to resume.`,
    );
  }

  async resumeAfterDeposit(userId: string) {
    const ledger = await this.getBalanceLedger(userId);
    if (ledger.availableBalance <= 0) return;

    await prisma.wallet.updateMany({
      where: { userId },
      data: {
        balance: toWalletBalance(ledger.onChainBalance),
        balanceCachedAt: new Date(),
      },
    });

    await prisma.employment.updateMany({
      where: { userId },
      data: { status: "Active", pausedAt: null, startedAt: new Date() },
    });

    const links = await prisma.groupEmployment.findMany({
      where: { userId, enabled: true },
    });
    for (const link of links) {
      await prisma.groupSettings.updateMany({
        where: { groupId: link.groupId },
        data: { enabled: true },
      });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet?.identityHash) {
      await blockchainService
        .resumeOnChain(identityUserKey(wallet.identityHash as `0x${string}`))
        .catch(() => undefined);
    }

    logEvent("Employment Resumed", { userId });
    await this.notify(
      userId,
      `Deposit received. Employment Active — available balance ${formatAmount(ledger.availableBalance, ledger.currency)}.`,
    );
  }

  async notify(userId: string, text: string) {
    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (!settings?.telegramUserId) {
      console.log("[billing-notify]", userId, text);
      return;
    }
    try {
      const { getBot } = await import("@/services/telegram.service");
      await getBot().telegram.sendMessage(Number(settings.telegramUserId), text);
    } catch (err) {
      console.warn("[billing-notify] failed", err);
    }
  }

  async getStatus() {
    const currencies = await paymentService.getEnabledCurrencies();
    const config = getSettlementConfig();
    return {
      active: true,
      mode: config.mode === "instant" ? "instant-on-chain" : "prepaid-settlement",
      settlementMode: config.mode,
      currencies,
      chainConfigured: blockchainService.isConfigured(),
      settlement: config,
      attributionTag: "celo_e3cc4c8d8a0e",
    };
  }
}

export const billingService = new BillingService();
