import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { walletProvider } from "@/lib/wallet-provider";
import { billingService } from "@/services/billing.service";
import { paymentService } from "@/services/payment.service";
import { emailIdentityHash, identityHash } from "@/lib/identity";
import { logEvent } from "@/lib/logger";
import { Errors } from "@/lib/errors";
import { formatAmount } from "@/lib/payment-currency";

function toBalanceNumber(value: { toString(): string } | string | number | null | undefined) {
  if (value == null) return 0;
  return Number(value.toString());
}

export class WalletService {
  async getForUser(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  }

  async ensureSmartWallet(userId: string, email?: string) {
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) {
      return {
        id: existing.id,
        address: existing.address,
        balance: toBalanceNumber(existing.balance),
        provider: existing.provider,
        identityHash: existing.identityHash,
      };
    }

    const hash = email
      ? emailIdentityHash(email)
      : (identityHash("wallet", userId) as string);
    const smart = await walletProvider.ensureSmartWallet({
      userId,
      identityHash: hash as `0x${string}`,
    });

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address: smart.address,
        provider: smart.provider,
        balance: 0,
        identityHash: hash,
      },
    });

    return {
      id: wallet.id,
      address: wallet.address,
      balance: 0,
      provider: wallet.provider,
      identityHash: wallet.identityHash,
    };
  }

  async syncBalanceFromChain(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return null;

    const currency = await paymentService.getActiveCurrency();
    const cached = toBalanceNumber(wallet.balance);

    const onChain = blockchainService.isConfigured()
      ? await blockchainService.syncBalanceCache(wallet.address as `0x${string}`)
      : null;

    // Blockchain is source of truth when readable; never replace cache with failed/stale zero reads.
    const balance = onChain !== null ? onChain : cached;

    if (onChain !== null && onChain !== cached) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: onChain, balanceCachedAt: new Date() },
      });
    }

    return { balance, currency, address: wallet.address };
  }

  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const currency = await paymentService.getActiveCurrency();

    if (!wallet) {
      return {
        connected: false,
        address: null as string | null,
        balance: 0,
        currency,
        provider: null as string | null,
        onChain: null,
      };
    }

    const synced = await this.syncBalanceFromChain(userId);
    const ledger = await billingService.getBalanceLedger(userId);

    return {
      connected: true,
      address: wallet.address,
      balance: synced?.balance ?? toBalanceNumber(wallet.balance),
      onChainBalance: ledger.onChainBalance,
      outstandingCharges: ledger.outstandingCharges,
      availableBalance: ledger.availableBalance,
      withdrawableBalance: ledger.withdrawableBalance,
      currency,
      provider: wallet.provider,
      onChain: synced
        ? { formatted: synced.balance.toString(), wei: null, contract: null }
        : null,
      identityHash: wallet.identityHash,
    };
  }

  /** Sync balance after on-chain deposit detected or manual refresh. */
  async handleDepositDetected(userId: string, previousBalance: number) {
    const synced = await this.syncBalanceFromChain(userId);
    if (!synced) return null;

    const currency = synced.currency;
    if (synced.balance > previousBalance) {
      const delta = synced.balance - previousBalance;
      logEvent("Deposit Detected", { userId, delta, currency });
      await billingService.notify(
        userId,
        `Deposit successful: +${formatAmount(delta, currency)}. Balance ${formatAmount(synced.balance, currency)}.`,
      );

      const employment = await prisma.employment.findUnique({ where: { userId } });
      if (
        employment &&
        (employment.status === "Inactive" || employment.status === "Exhausted") &&
        synced.balance > 0
      ) {
        await billingService.resumeAfterDeposit(userId);
      }
    }

    return synced;
  }

  async recordWithdraw(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.walletNotFunded();

    const ledger = await billingService.getBalanceLedger(userId);

    if (amount > ledger.withdrawableBalance) {
      throw Errors.walletNotFunded();
    }

    const current = ledger.onChainBalance;

    // Withdrawal executes on-chain via user's wallet calling contract withdraw — MVP records intent
    const newBal = current - amount;
    const currency = await paymentService.getActiveCurrency();

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBal, balanceCachedAt: new Date() },
    });

    if (newBal <= 0 && ledger.outstandingCharges <= 0) {
      await billingService.exhaustUser(userId, "withdrawn_to_zero");
    }

    logEvent("Withdrawal Completed", { userId, amount, currency });
    await billingService.notify(
      userId,
      `Withdrawal recorded: -${formatAmount(amount, currency)}. Balance ${formatAmount(newBal, currency)}.`,
    );

    return { address: wallet.address, balance: newBal, currency };
  }

  /** Deposit instructions for Method A (web) and Method B (direct transfer). */
  async getDepositConfig(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.walletNotFunded();

    const currency = await paymentService.getActiveCurrency();
    const contract = blockchainService.getContractAddress();
    const isCelo = currency === "CELO";

    return {
      employmentWallet: wallet.address,
      contract,
      currency,
      methodA: {
        description: "Connect wallet and deposit via the Employment contract",
        functionName: isCelo ? "depositNativeFor" : "depositERC20For",
        args: isCelo ? [wallet.address] : [wallet.address, "amount"],
        payable: isCelo,
      },
      methodB: {
        description: "Send supported assets then click Sync Balance",
        note: "Funds sent directly to your employment wallet address appear after blockchain synchronization.",
        employmentWallet: wallet.address,
      },
    };
  }
}

export const walletService = new WalletService();
