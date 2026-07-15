import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { walletProvider } from "@/lib/wallet-provider";

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
        currency: "USD",
        provider: null as string | null,
        onChain: null,
      };
    }

    const onChain = await blockchainService.getEmploymentBalance(wallet.address);

    return {
      connected: true,
      address: wallet.address,
      balance: toBalanceNumber(wallet.balance),
      currency: "USD",
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

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    const employment = await prisma.employment.findUnique({ where: { userId } });
    if (
      employment &&
      (employment.status === "Inactive" || employment.status === "Exhausted") &&
      toBalanceNumber(updated.balance) > 0
    ) {
      await prisma.employment.update({
        where: { userId },
        data: {
          status: "Active",
          startedAt: employment.startedAt ?? new Date(),
          pausedAt: null,
        },
      });
    }

    return {
      address: updated.address,
      balance: toBalanceNumber(updated.balance),
      currency: "USD",
    };
  }
}

export const walletService = new WalletService();
