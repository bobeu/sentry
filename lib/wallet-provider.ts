import type { Address, Hex } from "viem";
import { blockchainService } from "@/services/blockchain.service";

export type SmartWallet = {
  address: Address;
  provider: string;
};

export interface WalletProvider {
  readonly name: string;
  ensureSmartWallet(input: { userId: string; identityHash: Hex }): Promise<SmartWallet>;
}

/**
 * Deploys a real EmploymentWallet via EmploymentWalletFactory (one per identity, permanent).
 */
export class EmploymentFactoryWalletProvider implements WalletProvider {
  readonly name = "employment-wallet-factory";

  async ensureSmartWallet(input: {
    userId: string;
    identityHash: Hex;
  }): Promise<SmartWallet> {
    const address = await blockchainService.ensureEmploymentWallet(input.identityHash);
    return { address, provider: this.name };
  }
}

export const walletProvider: WalletProvider = new EmploymentFactoryWalletProvider();
