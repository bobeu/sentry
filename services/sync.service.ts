import { prisma } from "@/lib/prisma";
import { blockchainService } from "@/services/blockchain.service";
import { walletService } from "@/services/wallet.service";
import { logEvent } from "@/lib/logger";

/**
 * Lightweight blockchain sync — scheduled + user-triggered only (no continuous polling).
 */
export class SyncService {
  private running = false;

  async syncAllWallets() {
    if (this.running) return { skipped: true };
    if (!blockchainService.isConfigured()) return { synced: 0, reason: "chain_unconfigured" };

    this.running = true;
    let synced = 0;
    let deposits = 0;

    try {
      const wallets = await prisma.wallet.findMany({ select: { userId: true, balance: true } });
      for (const w of wallets) {
        const previous = Number(w.balance.toString());
        const result = await walletService.handleDepositDetected(w.userId, previous);
        if (result) {
          synced += 1;
          if (result.balance > previous) deposits += 1;
        }
      }
      if (synced > 0) {
        logEvent("Deposit Detected", { scheduled: true, wallets: synced, newDeposits: deposits });
      }
      return { synced, deposits };
    } finally {
      this.running = false;
    }
  }

  async syncUser(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return null;
    const previous = Number(wallet.balance.toString());
    return walletService.handleDepositDetected(userId, previous);
  }
}

export const syncService = new SyncService();
