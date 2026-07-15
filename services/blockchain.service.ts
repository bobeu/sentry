import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CONTRACTS } from "@/lib/contracts";
import type { PaymentCurrency } from "@/lib/payment-currency";
import { Errors } from "@/lib/errors";

const TOKEN_INDEX: Record<PaymentCurrency, number> = {
  CELO: 0,
  USDm: 1,
  USDC: 2,
  USDT: 3,
};

const employmentAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "activePaymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "charge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "actionId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resume",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "registerIdentity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityHash", type: "bytes32" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setActivePaymentToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "uint8" }],
    outputs: [],
  },
] as const;

const factoryAbi = [
  {
    type: "function",
    name: "createWallet",
    stateMutability: "nonpayable",
    inputs: [{ name: "identityHash", type: "bytes32" }],
    outputs: [{ name: "wallet", type: "address" }],
  },
  {
    type: "function",
    name: "walletFor",
    stateMutability: "view",
    inputs: [{ name: "identityHash", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

function operatorKey(): Hex | null {
  const raw = process.env.SENTRY_OPERATOR_KEY ?? process.env.PRIVATE_KEY;
  if (!raw?.trim()) return null;
  const key = raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`;
  return key as Hex;
}

function ownerKey(): Hex | null {
  const raw = process.env.SENTRY_OWNER_KEY ?? process.env.SENTRY_OPERATOR_KEY ?? process.env.PRIVATE_KEY;
  if (!raw?.trim()) return null;
  const key = raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`;
  return key as Hex;
}

/** Celo Mainnet only. Blockchain is source of truth for balances and charges. */
export class BlockchainService {
  isConfigured() {
    return Boolean(this.contractAddress() && operatorKey());
  }

  connect() {
    return {
      connected: this.isConfigured(),
      network: "celo-mainnet",
      chainId: 42220,
      employmentContract: CONTRACTS.EmploymentContract.address ?? null,
    };
  }

  private client() {
    return createPublicClient({
      chain: celo,
      transport: http(process.env.CELO_RPC ?? "https://forno.celo.org"),
    });
  }

  private contractAddress(): Address | null {
    const addr = CONTRACTS.EmploymentContract.address;
    if (!addr || !isAddress(addr)) return null;
    return addr;
  }

  private factoryAddress(): Address | null {
    const addr = CONTRACTS.EmploymentWalletFactory?.address;
    if (!addr || !isAddress(addr)) return null;
    return addr;
  }

  isFactoryConfigured() {
    return Boolean(this.factoryAddress() && operatorKey());
  }

  private async operatorWallet() {
    const key = operatorKey();
    const address = this.contractAddress();
    if (!key || !address) return null;
    const account = privateKeyToAccount(key);
    const wallet = createWalletClient({
      account,
      chain: celo,
      transport: http(process.env.CELO_RPC ?? "https://forno.celo.org"),
    });
    return { wallet, account, address };
  }

  private async ownerWallet() {
    const key = ownerKey();
    const address = this.contractAddress();
    if (!key || !address) return null;
    const account = privateKeyToAccount(key);
    const wallet = createWalletClient({
      account,
      chain: celo,
      transport: http(process.env.CELO_RPC ?? "https://forno.celo.org"),
    });
    return { wallet, account, address };
  }

  async getEmploymentBalance(address: string) {
    const contractAddress = this.contractAddress();
    if (!contractAddress || !isAddress(address)) return null;

    try {
      const raw = await this.client().readContract({
        address: contractAddress,
        abi: employmentAbi,
        functionName: "balanceOf",
        args: [address as Address],
      });
      return {
        wei: raw.toString(),
        formatted: formatEther(raw),
        contract: contractAddress,
      };
    } catch {
      return null;
    }
  }

  async syncBalanceCache(address: Address): Promise<number | null> {
    const onChain = await this.getEmploymentBalance(address);
    if (!onChain) return null;
    return Number(onChain.formatted);
  }

  /** Chain-first charge — throws if unavailable or tx fails. */
  async chargeOnChain(input: {
    account: Address;
    amount: number;
    actionId: Hex;
  }): Promise<string> {
    const op = await this.operatorWallet();
    if (!op) throw Errors.blockchainUnavailable();

    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "charge",
      args: [input.account, parseEther(input.amount.toString()), input.actionId],
      account: op.account,
      chain: celo,
    });
    const receipt = await this.client().waitForTransactionReceipt({ hash: hash as Hash });
    if (receipt.status !== "success") {
      throw Errors.chargeFailed("Transaction reverted on-chain");
    }
    return hash;
  }

  /** Batch settlement — service revenue + fee in one on-chain transfer. */
  async chargeSettlementOnChain(input: {
    account: Address;
    totalAmount: number;
    settlementId: Hex;
  }): Promise<string> {
    const op = await this.operatorWallet();
    if (!op) throw Errors.blockchainUnavailable();

    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: [
        ...employmentAbi,
        {
          type: "function",
          name: "chargeSettlement",
          stateMutability: "nonpayable",
          inputs: [
            { name: "account", type: "address" },
            { name: "totalAmount", type: "uint256" },
            { name: "settlementId", type: "bytes32" },
          ],
          outputs: [],
        },
      ] as const,
      functionName: "chargeSettlement",
      args: [input.account, parseEther(input.totalAmount.toString()), input.settlementId],
      account: op.account,
      chain: celo,
    });
    const receipt = await this.client().waitForTransactionReceipt({ hash: hash as Hash });
    if (receipt.status !== "success") {
      throw Errors.chargeFailed("Settlement transaction reverted on-chain");
    }
    return hash;
  }

  async pauseOnChain(account: Address): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    return op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "pause",
      args: [account],
      account: op.account,
      chain: celo,
    });
  }

  async resumeOnChain(account: Address): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    return op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "resume",
      args: [account],
      account: op.account,
      chain: celo,
    });
  }

  async registerIdentityOnChain(identityHash: Hex, wallet: Address): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    return op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "registerIdentity",
      args: [identityHash, wallet],
      account: op.account,
      chain: celo,
    });
  }

  /** Deploy or fetch employment wallet from factory (idempotent). */
  async ensureEmploymentWallet(identityHash: Hex): Promise<Address> {
    const factory = this.factoryAddress();
    const op = await this.operatorWallet();
    if (!factory || !op) throw Errors.blockchainUnavailable();

    const existing = await this.client().readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "walletFor",
      args: [identityHash],
    });

    if (existing && existing !== "0x0000000000000000000000000000000000000000") {
      return existing as Address;
    }

    const hash = await op.wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createWallet",
      args: [identityHash],
      account: op.account,
      chain: celo,
    });
    const receipt = await this.client().waitForTransactionReceipt({ hash: hash as Hash });
    if (receipt.status !== "success") {
      throw Errors.blockchainUnavailable();
    }

    const wallet = await this.client().readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "walletFor",
      args: [identityHash],
    });
    if (!wallet || wallet === "0x0000000000000000000000000000000000000000") {
      throw Errors.blockchainUnavailable();
    }
    return wallet as Address;
  }

  async setActivePaymentToken(currency: PaymentCurrency): Promise<string | null> {
    const owner = await this.ownerWallet();
    if (!owner) return null;
    return owner.wallet.writeContract({
      address: owner.address,
      abi: employmentAbi,
      functionName: "setActivePaymentToken",
      args: [TOKEN_INDEX[currency]],
      account: owner.account,
      chain: celo,
    });
  }

  getContractAddress(): Address | null {
    return this.contractAddress();
  }

  getDepositAbi() {
    return [
      ...employmentAbi,
      {
        type: "function",
        name: "depositNativeFor",
        stateMutability: "payable",
        inputs: [{ name: "account", type: "address" }],
        outputs: [],
      },
      {
        type: "function",
        name: "depositERC20For",
        stateMutability: "nonpayable",
        inputs: [
          { name: "account", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
      {
        type: "function",
        name: "depositNative",
        stateMutability: "payable",
        inputs: [],
        outputs: [],
      },
      {
        type: "function",
        name: "depositERC20",
        stateMutability: "nonpayable",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
      },
    ] as const;
  }
}

export const blockchainService = new BlockchainService();
