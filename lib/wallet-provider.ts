import { keccak256, encodePacked, getAddress, type Address } from "viem";

export type SmartWallet = {
  address: Address;
  provider: string;
};

/**
 * Abstract wallet layer. Backed today by a deterministic employment smart-wallet
 * address; replaceable later with Para, Privy, Dynamic, etc.
 */
export interface WalletProvider {
  readonly name: string;
  ensureSmartWallet(userId: string): Promise<SmartWallet>;
}

/**
 * Deterministic CREATE2-style address for the user's Sentry employment wallet.
 * No private key is generated or stored — deposits are tracked against this
 * address via the Employment smart contract / app ledger.
 */
export class EmploymentContractWalletProvider implements WalletProvider {
  readonly name = "employment-contract";

  async ensureSmartWallet(userId: string): Promise<SmartWallet> {
    // Fixed factory salt namespace for Sentry employment wallets on Celo.
    const namespace = "0x53656e747279456d706c6f796d656e7400000000000000000000000000000000";
    const hash = keccak256(
      encodePacked(["bytes32", "string"], [namespace as `0x${string}`, userId]),
    );
    // Map hash to a 20-byte address (not a deployable EOA key — identity only).
    const address = getAddress(`0x${hash.slice(26)}`);
    return { address, provider: this.name };
  }
}

export const walletProvider: WalletProvider = new EmploymentContractWalletProvider();
