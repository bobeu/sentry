import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { isAddress, getAddress, type Address } from "viem";

function toBalanceNumber(value: { toString(): string } | string | number | null | undefined) {
  if (value == null) return 0;
  return Number(value.toString());
}

export class WalletService {
  async getForUser(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  async createWallet(userId: string) {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) {
      throw new Error("Wallet already exists for this user");
    }

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address: account.address,
        balance: 0,
      },
    });

    return {
      wallet: {
        id: wallet.id,
        address: wallet.address,
        balance: toBalanceNumber(wallet.balance),
      },
      // Returned once — caller must save it. Not stored in the database.
      privateKey,
    };
  }

  async connectWallet(userId: string, addressInput: string) {
    if (!isAddress(addressInput)) {
      throw new Error("Invalid wallet address");
    }

    const address = getAddress(addressInput) as Address;
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) {
      throw new Error("Wallet already connected for this user");
    }

    const taken = await prisma.wallet.findUnique({ where: { address } });
    if (taken) {
      throw new Error("This wallet is already linked to another account");
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address,
        balance: 0,
      },
    });

    return {
      id: wallet.id,
      address: wallet.address,
      balance: toBalanceNumber(wallet.balance),
    };
  }

  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return {
        connected: false,
        address: null,
        balance: 0,
        currency: "USD",
        onChain: null,
      };
    }

    const onChain = await blockchainService.getEmploymentBalance(wallet.address);

    return {
      connected: true,
      address: wallet.address,
      balance: toBalanceNumber(wallet.balance),
      currency: "USD",
      onChain,
    };
  }

  /**
   * Records a deposit against the prepaid employment balance.
   * Uses an explicit amount (test-friendly). When the contract is deployed,
   * clients can pass the on-chain receipt amount here after calling deposit().
   */
  async recordDeposit(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be greater than zero");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new Error("Create or connect a wallet first");
    }

    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount,
        },
      },
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
