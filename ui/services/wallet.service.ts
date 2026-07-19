import { isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { walletProvider } from "@/lib/wallet-provider";
import { billingService } from "@/services/billing.service";
import { paymentService } from "@/services/payment.service";
import { emailIdentityHash, identityHash, identityUserKey } from "@/lib/identity";
import { logEvent } from "@/lib/logger";
import { Errors } from "@/lib/errors";
import { formatAmount, type PaymentCurrency } from "@/lib/payment-currency";

function number(value: { toString(): string } | string | number | null | undefined) {
  return value == null ? 0 : Number(value.toString());
}

function walletUserKey(identityHashValue: string): Address {
  return identityUserKey(identityHashValue as Hex);
}

export class WalletService {
  async getForUser(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  async ensureSmartWallet(
    userId: string,
    email?: string,
    requestedCurrency?: PaymentCurrency,
  ) {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) {
      return {
        id: existing.id,
        address: existing.address,
        balance: number(existing.balance),
        provider: existing.provider,
        identityHash: existing.identityHash,
        currency: existing.walletCurrency as PaymentCurrency,
      };
    }

    const currency = requestedCurrency ?? (await paymentService.getDefaultCurrency());
    await paymentService.assertEnabled(currency);
    const hash = email ? emailIdentityHash(email) : identityHash("wallet", userId);
    const userKey = identityUserKey(hash);
    const smart = await walletProvider.ensureSmartWallet({
      userId,
      identityHash: hash,
      userKey,
      currency,
    });

    await blockchainService.registerEmploymentOnChain(userKey, smart.address);

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address: smart.address,
        provider: smart.provider,
        balance: 0,
        identityHash: hash,
        walletCurrency: currency,
        walletStatus: "Active",
      },
    });

    return {
      id: wallet.id,
      address: wallet.address,
      balance: 0,
      provider: wallet.provider,
      identityHash: wallet.identityHash,
      currency,
    };
  }

  async syncBalanceFromChain(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return null;
    const currency = wallet.walletCurrency as PaymentCurrency;
    const cached = number(wallet.balance);
    const onChain = blockchainService.isConfigured()
      ? await blockchainService.syncBalanceCache(
          wallet.address as Address,
          currency,
        )
      : null;
    const balance = onChain ?? cached;

    if (onChain !== null && Number.isFinite(onChain) && onChain !== cached) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: onChain, balanceCachedAt: new Date() },
      });
      if (wallet.identityHash && onChain > cached) {
        await blockchainService
          .notifyWalletFunding(
            walletUserKey(wallet.identityHash),
            wallet.address as Address,
            onChain - cached,
            currency,
          )
          .catch(() => undefined);
      }
    }
    return { balance, currency, address: wallet.address };
  }

  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return {
        connected: false,
        address: null,
        balance: 0,
        currency: await paymentService.getDefaultCurrency(),
        provider: null,
        onChain: null,
      };
    }

    const synced = await this.syncBalanceFromChain(userId);
    const ledger = await billingService.getBalanceLedger(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { withdrawalAddress: true, pendingWithdrawalAddress: true },
    });

    return {
      connected: true,
      address: wallet.address,
      balance: synced?.balance ?? number(wallet.balance),
      onChainBalance: ledger.onChainBalance,
      outstandingCharges: ledger.outstandingCharges,
      availableBalance: ledger.availableBalance,
      withdrawableBalance: ledger.withdrawableBalance,
      currency: wallet.walletCurrency,
      walletStatus: wallet.walletStatus,
      withdrawalAddress: user?.withdrawalAddress ?? null,
      pendingWithdrawalAddress: user?.pendingWithdrawalAddress ?? null,
      provider: wallet.provider,
      identityHash: wallet.identityHash,
    };
  }

  async handleDepositDetected(userId: string, previousBalance: number) {
    const synced = await this.syncBalanceFromChain(userId);
    if (!synced) return null;
    if (synced.balance > previousBalance) {
      const delta = synced.balance - previousBalance;
      logEvent("Deposit Detected", { userId, delta, currency: synced.currency });
      await billingService.notify(
        userId,
        `Deposit successful: +${formatAmount(delta, synced.currency)}. Balance ${formatAmount(synced.balance, synced.currency)}.`,
      );
      const employment = await prisma.employment.findUnique({ where: { userId } });
      if (
        employment &&
        (employment.status === "Inactive" || employment.status === "Exhausted")
      ) {
        await billingService.resumeAfterDeposit(userId);
      }
    }
    return synced;
  }

  async setWithdrawalAddress(userId: string, destination: string) {
    if (!isAddress(destination)) throw new Error("Invalid withdrawal address");
    await prisma.user.update({
      where: { id: userId },
      data: { pendingWithdrawalAddress: destination },
    });
    logEvent("Withdrawal Destination Pending", { userId, destination });
    await billingService.notify(
      userId,
      `Confirm your new withdrawal destination ${destination} before it becomes active.`,
    );
    return {
      pendingWithdrawalAddress: destination,
      withdrawalAddress: (
        await prisma.user.findUnique({
          where: { id: userId },
          select: { withdrawalAddress: true },
        })
      )?.withdrawalAddress ?? null,
      confirmationRequired: true,
    };
  }

  async confirmWithdrawalAddress(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user?.pendingWithdrawalAddress || !isAddress(user.pendingWithdrawalAddress)) {
      throw new Error("No pending withdrawal destination to confirm");
    }
    if (!user.wallet?.identityHash) throw new Error("Wallet identity is missing");

    const destination = user.pendingWithdrawalAddress as Address;
    if (blockchainService.isConfigured()) {
      await blockchainService.setWithdrawalDestination(
        walletUserKey(user.wallet.identityHash),
        destination,
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        withdrawalAddress: destination,
        pendingWithdrawalAddress: null,
      },
    });

    logEvent("Withdrawal Destination Confirmed", { userId, destination });
    return { withdrawalAddress: destination, pendingWithdrawalAddress: null };
  }

  async recordWithdraw(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, employment: true },
    });
    if (!user?.wallet) throw Errors.walletNotFunded();
    if (user.pendingWithdrawalAddress) {
      throw new Error("Confirm the pending withdrawal destination before withdrawing");
    }
    if (!user.withdrawalAddress || !isAddress(user.withdrawalAddress)) {
      throw new Error("Set and confirm a valid withdrawal destination first");
    }
    if (!user.wallet.identityHash) throw new Error("Wallet identity is missing");

    const before = await billingService.getBalanceLedger(userId);
    if (amount > before.withdrawableBalance) {
      throw new Error(
        `Maximum withdrawal is ${formatAmount(before.withdrawableBalance, before.currency)}`,
      );
    }

    if (before.outstandingCharges > 0) {
      const settlement = await billingService.settleEmployment(userId);
      if (!settlement || settlement.status === "failed") {
        throw new Error("Outstanding charges must settle before withdrawal");
      }
    }

    const afterSettlement = await billingService.getBalanceLedger(userId);
    if (amount > afterSettlement.onChainBalance) throw Errors.walletNotFunded();

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        walletId: user.wallet.id,
        amount,
        currency: user.wallet.walletCurrency,
        destination: user.withdrawalAddress,
        status: "pending",
      },
    });

    try {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "submitted" },
      });
      const userKey = walletUserKey(user.wallet.identityHash);
      await blockchainService.setWithdrawalDestination(
        userKey,
        user.withdrawalAddress as Address,
      );
      const txHash = await blockchainService.withdrawOnChain(
        userKey,
        keccak256(toBytes(withdrawal.id)),
        amount,
        user.wallet.walletCurrency as PaymentCurrency,
      );
      const newBalance =
        (await blockchainService.syncBalanceCache(
          user.wallet.address as Address,
          user.wallet.walletCurrency as PaymentCurrency,
        )) ??
        afterSettlement.onChainBalance - amount;

      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "succeeded",
            transactionHash: txHash,
            completedAt: new Date(),
          },
        }),
        prisma.wallet.update({
          where: { id: user.wallet.id },
          data: { balance: newBalance, balanceCachedAt: new Date() },
        }),
      ]);

      logEvent("Withdrawal Completed", {
        userId,
        amount,
        currency: user.wallet.walletCurrency,
        destination: user.withdrawalAddress,
        txHash,
      });
      return {
        id: withdrawal.id,
        address: user.wallet.address,
        destination: user.withdrawalAddress,
        balance: newBalance,
        currency: user.wallet.walletCurrency,
        transactionHash: txHash,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Withdrawal failed";
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "failed", failureReason: reason },
      });
      throw error;
    }
  }

  async getDepositConfig(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.walletNotFunded();
    const currency = wallet.walletCurrency as PaymentCurrency;
    const tokenAddress =
      currency === "CELO"
        ? null
        : await blockchainService.getWalletTokenAddress(wallet.address as Address);

    return {
      employmentWallet: wallet.address,
      currency,
      tokenAddress,
      methodA: {
        description: "Transfer the wallet's configured currency directly to SentryWallet",
        type: currency === "CELO" ? "native-transfer" : "erc20-transfer",
      },
      methodB: {
        description: "Send funds to the SentryWallet address, then sync balance",
        employmentWallet: wallet.address,
      },
    };
  }

  async getWithdrawalHistory(userId: string) {
    return prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
  }
}

export const walletService = new WalletService();
