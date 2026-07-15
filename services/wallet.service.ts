import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { walletProvider } from "@/lib/wallet-provider";
import { billingService } from "@/services/billing.service";

function toBalanceNumber(value: { toString(): string } | string | number | null | undefined) {
  if (value == null) return 0;
  return Number(value.toString());
}

export class WalletService {
  async getForUser(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  /**
   * Ensure the user has a smart wallet managed by the employment layer.
   * Never generates or returns private keys.
   */
  async ensureSmartWallet(userId: string) {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) {
      return {
        id: existing.id,
        address: existing.address,
        balance: toBalanceNumber(existing.balance),
        provider: existing.provider,
      };
    }

    const smart = await walletProvider.ensureSmartWallet(userId);
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address: smart.address,
        provider: smart.provider,
        balance: 0,
      },
    });

    return {
      id: wallet.id,
      address: wallet.address,
      balance: toBalanceNumber(wallet.balance),
      provider: wallet.provider,
    };
  }

  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return {
        connected: false,
        address: null as string | null,
        balance: 0,
        currency: "cUSD",
        provider: null as string | null,
        onChain: null,
      };
    }

    const onChain = await blockchainService.getEmploymentBalance(wallet.address);

    return {
      connected: true,
      address: wallet.address,
      balance: toBalanceNumber(wallet.balance),
      currency: "cUSD",
      provider: wallet.provider,
      onChain,
    };
  }

  async recordDeposit(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be greater than zero");
    }

    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      await this.ensureSmartWallet(userId);
      wallet = await prisma.wallet.findUnique({ where: { userId } });
    }
    if (!wallet) {
      throw new Error("Smart wallet could not be created");
    }

    const wasExhausted =
      (await prisma.employment.findUnique({ where: { userId } }))?.status === "Exhausted";

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await blockchainService
      .creditOnChain(updated.address as `0x${string}`, amount)
      .catch(() => undefined);

    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (
      employment &&
      (employment.status === "Inactive" || employment.status === "Exhausted") &&
      toBalanceNumber(updated.balance) > 0
    ) {
      await billingService.resumeAfterDeposit(userId);
    }

    await billingService.notify(
      userId,
      `Deposit successful: +$${amount.toFixed(3)} cUSD. Balance $${toBalanceNumber(updated.balance).toFixed(3)}.`,
    );

    return {
      address: updated.address,
      balance: toBalanceNumber(updated.balance),
      currency: "cUSD",
      resumed: wasExhausted,
    };
  }

  async recordWithdraw(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("No wallet found");

    const current = toBalanceNumber(wallet.balance);
    if (amount > current) {
      throw new Error("Insufficient balance");
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    const newBal = toBalanceNumber(updated.balance);
    if (newBal <= 0) {
      await billingService.exhaustUser(userId, "withdrawn_to_zero");
    }

    await billingService.notify(
      userId,
      `Withdrawal successful: -$${amount.toFixed(3)} cUSD. Balance $${newBal.toFixed(3)}.`,
    );

    return {
      address: updated.address,
      balance: newBal,
      currency: "cUSD",
    };
  }
}

export const walletService = new WalletService();
