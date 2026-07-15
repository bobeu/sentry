import { prisma } from "@/lib/prisma";
import type { ActionType } from "@prisma/client";
import { averageActionCost, getPricing, priceFor, PRICING_LABELS } from "@/lib/pricing";
import { blockchainService } from "@/services/blockchain.service";
import { keccak256, toBytes } from "viem";

function bal(value: { toString(): string } | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

export class BillingService {
  getPricing() {
    return getPricing();
  }

  calculateCharge(type: ActionType) {
    return priceFor(type);
  }

  async getSpending(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayAgg, lifetimeAgg, wallet, recentCharges] = await Promise.all([
      prisma.chargeRecord.aggregate({
        where: {
          status: "succeeded",
          createdAt: { gte: startOfDay },
          actionRecord: { userId },
        },
        _sum: { amount: true },
      }),
      prisma.chargeRecord.aggregate({
        where: {
          status: "succeeded",
          actionRecord: { userId },
        },
        _sum: { amount: true },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.chargeRecord.findMany({
        where: { status: "succeeded", actionRecord: { userId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actionRecord: true },
      }),
    ]);

    const todaySpend = bal(todayAgg._sum.amount);
    const lifetimeSpend = bal(lifetimeAgg._sum.amount);
    const balance = bal(wallet?.balance);
    const avg = averageActionCost();
    const estimatedRemaining = avg > 0 ? Math.floor(balance / avg) : 0;

    // Simple spending series for lightweight dashboard graph (last 7 days)
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
      series.push({
        date: day.toISOString().slice(0, 10),
        spend: bal(agg._sum.amount),
      });
    }

    return {
      todaySpend,
      lifetimeSpend,
      balance,
      currency: "cUSD",
      estimatedRemainingActions: estimatedRemaining,
      averageActionCost: avg,
      recentCharges: recentCharges.map((c) => ({
        id: c.id,
        amount: bal(c.amount),
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
      status: c.status,
      transactionHash: c.transactionHash,
      createdAt: c.createdAt,
      label: PRICING_LABELS[c.actionRecord.type],
      type: c.actionRecord.type,
      groupName: c.actionRecord.group?.name ?? null,
    }));
  }

  /**
   * Bill a completed ActionRecord exactly once.
   */
  async chargeUser(actionRecordId: string) {
    const action = await prisma.actionRecord.findUnique({
      where: { id: actionRecordId },
      include: { charge: true, user: { include: { wallet: true, settings: true } } },
    });

    if (!action) throw new Error("ActionRecord not found");
    if (action.charge) return action.charge; // prevent duplicate billing
    if (action.status !== "completed" || !action.billable) {
      return null;
    }
    if (!action.userId || !action.user?.wallet) {
      return null;
    }

    const amount = this.calculateCharge(action.type);
    if (amount <= 0) return null;

    const wallet = action.user.wallet;
    const current = bal(wallet.balance);
    if (current < amount) {
      await this.exhaustUser(action.userId, "insufficient_balance_on_charge");
      await prisma.chargeRecord.create({
        data: {
          actionRecordId: action.id,
          amount,
          status: "failed",
        },
      });
      throw new Error("Insufficient balance");
    }

    const actionHash = keccak256(toBytes(action.id));
    let txHash: string | null = null;
    try {
      txHash = await blockchainService.chargeOnChain({
        account: wallet.address as `0x${string}`,
        amountCusd: amount,
        actionId: actionHash,
      });
    } catch (err) {
      console.warn("[billing] on-chain charge skipped/failed", err);
    }

    const [charge] = await prisma.$transaction([
      prisma.chargeRecord.create({
        data: {
          actionRecordId: action.id,
          amount,
          status: "succeeded",
          transactionHash: txHash,
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
    ]);

    const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
    const newBal = bal(updatedWallet?.balance);

    const lifetimeAgg = await prisma.chargeRecord.aggregate({
      where: { status: "succeeded", actionRecord: { userId: action.userId } },
      _sum: { amount: true },
    });
    const lifetimeSpend = bal(lifetimeAgg._sum.amount);
    const funded = newBal + lifetimeSpend;
    if (funded > 0 && newBal > 0 && newBal / funded < 0.2) {
      await this.notify(
        action.userId,
        `Balance low (<20% of funds used): $${newBal.toFixed(3)} cUSD remaining.`,
      );
    }

    if (newBal <= 0) {
      await this.exhaustUser(action.userId, "balance_zero");
    }

    return charge;
  }

  async refund(chargeId: string) {
    const charge = await prisma.chargeRecord.findUnique({
      where: { id: chargeId },
      include: { actionRecord: true },
    });
    if (!charge || charge.status !== "succeeded") {
      throw new Error("Charge not refundable");
    }
    const userId = charge.actionRecord.userId;
    if (!userId) throw new Error("Missing user");

    await prisma.$transaction([
      prisma.chargeRecord.update({
        where: { id: chargeId },
        data: { status: "refunded" },
      }),
      prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: charge.amount } },
      }),
    ]);

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

    await this.notify(
      userId,
      `Employment exhausted (${reason}). Sentry stopped working. Deposit funds to resume.`,
    );
  }

  async resumeAfterDeposit(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || bal(wallet.balance) <= 0) return;

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
    await this.notify(userId, "Deposit received. Employment Active — your groups are reactivated.");
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

  getStatus() {
    return { active: true, mode: "pay-per-completed-work", currency: "cUSD" };
  }
}

export const billingService = new BillingService();
