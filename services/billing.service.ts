import { prisma } from "@/lib/prisma";
import type { ActionType } from "@prisma/client";
import { averageActionCost, priceFor, PRICING_LABELS } from "@/lib/pricing";
import { blockchainService } from "@/services/blockchain.service";
import { paymentService } from "@/services/payment.service";
import { keccak256, toBytes } from "viem";
import { Errors } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { formatAmount } from "@/lib/payment-currency";

function bal(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class BillingService {
  async getPricing() {
    const currency = await paymentService.getActiveCurrency();
    const { getPricing } = await import("@/lib/pricing");
    return getPricing(currency);
  }

  calculateCharge(type: ActionType) {
    return priceFor(type);
  }

  async getSpending(userId: string) {
    const currency = await paymentService.getActiveCurrency();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    let balance = bal(wallet?.balance);
    if (wallet && blockchainService.isConfigured()) {
      const chainBal = await blockchainService.syncBalanceCache(wallet.address as `0x${string}`);
      if (chainBal !== null) balance = chainBal;
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance, balanceCachedAt: new Date() },
      });
    }

    const [todayAgg, lifetimeAgg, recentCharges] = await Promise.all([
      prisma.chargeRecord.aggregate({
        where: {
          status: "succeeded",
          createdAt: { gte: startOfDay },
          actionRecord: { userId },
        },
        _sum: { amount: true },
      }),
      prisma.chargeRecord.aggregate({
        where: { status: "succeeded", actionRecord: { userId } },
        _sum: { amount: true },
      }),
      prisma.chargeRecord.findMany({
        where: { actionRecord: { userId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actionRecord: true },
      }),
    ]);

    const todaySpend = bal(todayAgg._sum.amount);
    const lifetimeSpend = bal(lifetimeAgg._sum.amount);
    const avg = averageActionCost();
    const estimatedRemaining = avg > 0 ? Math.floor(balance / avg) : 0;

    const series = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const agg = await prisma.chargeRecord.aggregate({
        where: {
          status: "succeeded",
          createdAt: { gte: day, lt: next },
          actionRecord: { userId },
        },
        _sum: { amount: true },
      });
      series.push({ date: day.toISOString().slice(0, 10), spend: bal(agg._sum.amount) });
    }

    return {
      todaySpend,
      lifetimeSpend,
      balance,
      currency,
      estimatedRemainingActions: estimatedRemaining,
      averageActionCost: avg,
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
      series,
    };
  }

  async getHistory(userId: string, take = 50) {
    const charges = await prisma.chargeRecord.findMany({
      where: { actionRecord: { userId } },
      orderBy: { createdAt: "desc" },
      take,
      include: { actionRecord: { include: { group: true } } },
    });
    return charges.map((c) => ({
      id: c.id,
      amount: bal(c.amount),
      currency: c.currency,
      status: c.status,
      transactionHash: c.transactionHash,
      createdAt: c.createdAt,
      label: PRICING_LABELS[c.actionRecord.type],
      type: c.actionRecord.type,
      groupName: c.actionRecord.group?.name ?? null,
    }));
  }

  /**
   * Chain-first billing: pending charge → on-chain charge → DB success only after chain confirms.
   */
  async chargeUser(actionRecordId: string) {
    const action = await prisma.actionRecord.findUnique({
      where: { id: actionRecordId },
      include: { charge: true, user: { include: { wallet: true, settings: true } } },
    });

    if (!action) throw new Error("ActionRecord not found");
    if (action.charge) return action.charge;
    if (action.status !== "completed" || !action.billable) return null;
    if (!action.userId || !action.user?.wallet) return null;

    const amount = this.calculateCharge(action.type);
    if (amount <= 0) return null;

    const currency = await paymentService.getActiveCurrency();
    const wallet = action.user.wallet;
    const actionHash = keccak256(toBytes(action.id));

    const pending = await prisma.chargeRecord.create({
      data: {
        actionRecordId: action.id,
        amount,
        currency,
        status: "pending",
      },
    });

    logEvent("Charge Pending", { actionId: action.id, amount, currency });

    if (!blockchainService.isConfigured()) {
      await prisma.chargeRecord.update({
        where: { id: pending.id },
        data: {
          status: "failed",
          failureReason: "Blockchain not configured",
        },
      });
      logEvent("Charge Failed", { actionId: action.id, reason: "blockchain_unavailable" });
      await this.notify(
        action.userId,
        `Charge pending: blockchain unavailable. Your completed work was not billed yet.`,
      );
      throw Errors.blockchainUnavailable();
    }

    const chainBalance =
      (await blockchainService.syncBalanceCache(wallet.address as `0x${string}`)) ??
      toBalanceNumber(wallet.balance);
    if (chainBalance < amount) {
      await prisma.chargeRecord.update({
        where: { id: pending.id },
        data: { status: "failed", failureReason: "Insufficient on-chain balance" },
      });
      await this.exhaustUser(action.userId, "insufficient_balance_on_charge");
      throw Errors.walletNotFunded();
    }

    try {
      const txHash = await blockchainService.chargeOnChain({
        account: wallet.address as `0x${string}`,
        amount,
        actionId: actionHash,
      });

      const newBal =
        (await blockchainService.syncBalanceCache(wallet.address as `0x${string}`)) ?? chainBalance - amount;
      const charge = await prisma.$transaction([
        prisma.chargeRecord.update({
          where: { id: pending.id },
          data: { status: "succeeded", transactionHash: txHash },
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBal, balanceCachedAt: new Date() },
        }),
      ]);

      logEvent("Charge Completed", { actionId: action.id, txHash, amount, currency });

      const lifetimeAgg = await prisma.chargeRecord.aggregate({
        where: { status: "succeeded", actionRecord: { userId: action.userId } },
        _sum: { amount: true },
      });
      const lifetimeSpend = bal(lifetimeAgg._sum.amount);
      const funded = newBal + lifetimeSpend;
      if (funded > 0 && newBal > 0 && newBal / funded < 0.2) {
        await this.notify(
          action.userId,
          `Balance low (<20%): ${formatAmount(newBal, currency)} remaining.`,
        );
        logEvent("Low Balance", { userId: action.userId, balance: newBal, currency });
      }

      if (newBal <= 0) {
        await this.exhaustUser(action.userId, "balance_zero");
      }

      return charge[0];
    } catch (err) {
      const reason = err instanceof Error ? err.message : "charge_failed";
      await prisma.chargeRecord.update({
        where: { id: pending.id },
        data: { status: "failed", failureReason: reason },
      });
      logEvent("Charge Failed", { actionId: action.id, reason });
      await this.notify(
        action.userId,
        `Smart contract charge failed for ${PRICING_LABELS[action.type]}. Work completed but not billed. Please retry after funding.`,
      );
      throw Errors.chargeFailed(reason);
    }
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

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await blockchainService.pauseOnChain(wallet.address as `0x${string}`).catch(() => undefined);
    }

    logEvent("Employment Exhausted", { userId, reason });
    await this.notify(
      userId,
      `Employment exhausted (${reason}). Sentry stopped working. Deposit funds to resume.`,
    );
  }

  async resumeAfterDeposit(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return;

    const balance =
      (blockchainService.isConfigured()
        ? await blockchainService.syncBalanceCache(wallet.address as `0x${string}`)
        : null) ?? bal(wallet.balance);
    if (balance <= 0) return;

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance, balanceCachedAt: new Date() },
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

    await blockchainService.resumeOnChain(wallet.address as `0x${string}`).catch(() => undefined);
    logEvent("Employment Resumed", { userId });
    const currency = await paymentService.getActiveCurrency();
    await this.notify(
      userId,
      `Deposit received. Employment Active — balance ${formatAmount(balance, currency)}.`,
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
    const currency = await paymentService.getActiveCurrency();
    return {
      active: true,
      mode: "pay-per-completed-work",
      currency,
      chainConfigured: blockchainService.isConfigured(),
    };
  }
}

export const billingService = new BillingService();
