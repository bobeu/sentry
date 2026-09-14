import type { Address, Hex } from "viem";
import { blockchainService } from "@/services/blockchain.service";
import type { PaymentCurrency } from "@/lib/payment-currency";

export type SmartWallet = {
  address: Address;
  provider: string;
};

export interface WalletProvider {
  readonly name: string;
  ensureSmartWallet(input: {
    userId: string;
    identityHash: Hex;
    userKey: Address;
    currency: PaymentCurrency;
  }): Promise<SmartWallet>;
}

/**
 * Deploys a manager-controlled SentryWallet with one immutable currency.
 */
export class EmploymentFactoryWalletProvider implements WalletProvider {
  readonly name = "employment-wallet-factory";

  async ensureSmartWallet(input: {
    userId: string;
    identityHash: Hex;
    userKey: Address;
    currency: PaymentCurrency;
  }): Promise<SmartWallet> {
    const address = await blockchainService.ensureSentryWallet(input);
    return { address, provider: "sentry-wallet-factory" };
  }
}

export const walletProvider: WalletProvider = new EmploymentFactoryWalletProvider();
