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

const walletAbi = [
  {
    type: "function",
    name: "balance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paymentCurrency",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "tokenAddress",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const factoryAbi = [
  {
    type: "function",
    name: "createWallet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityHash", type: "bytes32" },
      { name: "userKey", type: "address" },
      { name: "currency", type: "uint8" },
    ],
    outputs: [{ name: "wallet", type: "address" }],
  },
  {
    type: "function",
    name: "walletOfIdentity",
    stateMutability: "view",
    inputs: [{ name: "identityHash", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setCurrencyEnabled",
    stateMutability: "nonpayable",
    inputs: [
      { name: "currency", type: "uint8" },
      { name: "enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateTokenAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "currency", type: "uint8" },
      { name: "newAddress", type: "address" },
    ],
    outputs: [],
  },
] as const;

const managerAbi = [
  {
    type: "function",
    name: "registerEmployment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "chargeSettlement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "settlementId", type: "bytes32" },
      { name: "serviceAmount", type: "uint256" },
      { name: "settlementFee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setWithdrawalDestination",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "destination", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "withdrawalId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pauseEmployment",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resumeEmployment",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
] as const;

function key(name: "owner" | "operator"): Hex | null {
  const raw =
    name === "owner"
      ? process.env.SENTRY_OWNER_KEY ?? process.env.SENTRY_OPERATOR_KEY ?? process.env.PRIVATE_KEY
      : process.env.SENTRY_OPERATOR_KEY ?? process.env.PRIVATE_KEY;
  if (!raw?.trim()) return null;
  return (raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`) as Hex;
}

function configuredAddress(
  envName: string,
  contract: { address?: Address; addresses: Record<string, string> },
): Address | null {
  const candidate = process.env[envName] ?? contract.address ?? contract.addresses["42220"];
  return candidate && isAddress(candidate) ? (candidate as Address) : null;
}

export class BlockchainService {
  private client() {
    return createPublicClient({
      chain: celo,
      transport: http(process.env.CELO_RPC ?? "https://forno.celo.org"),
    });
  }

  private managerAddress() {
    return configuredAddress(
      "EMPLOYMENT_MANAGER_ADDRESS",
      CONTRACTS.EmploymentManager as {
        address?: Address;
        addresses: Record<string, string>;
      },
    );
  }

  private factoryAddress() {
    return configuredAddress(
      "SENTRY_WALLET_FACTORY_ADDRESS",
      CONTRACTS.SentryWalletFactory as {
        address?: Address;
        addresses: Record<string, string>;
      },
    );
  }

  private walletClient(kind: "owner" | "operator", address: Address | null) {
    const privateKey = key(kind);
    if (!privateKey || !address) return null;
    const account = privateKeyToAccount(privateKey);
    return {
      account,
      address,
      wallet: createWalletClient({
        account,
        chain: celo,
        transport: http(process.env.CELO_RPC ?? "https://forno.celo.org"),
      }),
    };
  }

  isConfigured() {
    return Boolean(this.managerAddress() && key("operator"));
  }

  isFactoryConfigured() {
    return Boolean(this.factoryAddress() && key("owner"));
  }

  connect() {
    return {
      connected: this.isConfigured(),
      network: "celo-mainnet",
      chainId: 42220,
      employmentManager: this.managerAddress(),
      walletFactory: this.factoryAddress(),
    };
  }

  async getEmploymentBalance(address: string) {
    if (!isAddress(address)) return null;
    try {
      const raw = await this.client().readContract({
        address: address as Address,
        abi: walletAbi,
        functionName: "balance",
      });
      return {
        wei: raw.toString(),
        formatted: formatEther(raw),
        contract: address,
      };
    } catch {
      return null;
    }
  }

  async syncBalanceCache(address: Address): Promise<number | null> {
    const balance = await this.getEmploymentBalance(address);
    return balance ? Number(balance.formatted) : null;
  }

  async getWalletTokenAddress(address: Address): Promise<Address | null> {
    try {
      const token = await this.client().readContract({
        address,
        abi: walletAbi,
        functionName: "tokenAddress",
      });
      return token === "0x0000000000000000000000000000000000000000"
        ? null
        : (token as Address);
    } catch {
      return null;
    }
  }

  async ensureSentryWallet(input: {
    identityHash: Hex;
    userKey: Address;
    currency: PaymentCurrency;
  }): Promise<Address> {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();

    const existing = await this.client().readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "walletOfIdentity",
      args: [input.identityHash],
    });
    if (existing !== "0x0000000000000000000000000000000000000000") {
      return existing as Address;
    }

    const hash = await owner.wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createWallet",
      args: [input.identityHash, input.userKey, TOKEN_INDEX[input.currency]],
      account: owner.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return (await this.client().readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "walletOfIdentity",
      args: [input.identityHash],
    })) as Address;
  }

  async registerEmploymentOnChain(userKey: Address, walletAddress: Address) {
    const manager = this.managerAddress();
    const owner = this.walletClient("owner", manager);
    if (!manager || !owner) throw Errors.blockchainUnavailable();
    const hash = await owner.wallet.writeContract({
      address: manager,
      abi: managerAbi,
      functionName: "registerEmployment",
      args: [userKey, walletAddress],
      account: owner.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  async chargeSettlementOnChain(input: {
    userKey: Address;
    serviceAmount: number;
    settlementFee: number;
    settlementId: Hex;
  }) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    const hash = await operator.wallet.writeContract({
      address: manager,
      abi: managerAbi,
      functionName: "chargeSettlement",
      args: [
        input.userKey,
        input.settlementId,
        parseEther(input.serviceAmount.toString()),
        parseEther(input.settlementFee.toString()),
      ],
      account: operator.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  async setWithdrawalDestination(userKey: Address, destination: Address) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    const hash = await operator.wallet.writeContract({
      address: manager,
      abi: managerAbi,
      functionName: "setWithdrawalDestination",
      args: [userKey, destination],
      account: operator.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  async withdrawOnChain(userKey: Address, withdrawalId: Hex, amount: number) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    const hash = await operator.wallet.writeContract({
      address: manager,
      abi: managerAbi,
      functionName: "withdraw",
      args: [userKey, withdrawalId, parseEther(amount.toString())],
      account: operator.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  async pauseOnChain(userKey: Address) {
    return this.writeEmploymentState("pauseEmployment", userKey);
  }

  async resumeOnChain(userKey: Address) {
    return this.writeEmploymentState("resumeEmployment", userKey);
  }

  async setCurrencyEnabled(currency: PaymentCurrency, enabled: boolean) {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    const hash = await owner.wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "setCurrencyEnabled",
      args: [TOKEN_INDEX[currency], enabled],
      account: owner.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  async updateTokenAddress(currency: PaymentCurrency, tokenAddress: Address) {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    const hash = await owner.wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "updateTokenAddress",
      args: [TOKEN_INDEX[currency], tokenAddress],
      account: owner.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  getManagerAddress() {
    return this.managerAddress();
  }

  getFactoryAddress() {
    return this.factoryAddress();
  }

  private async writeEmploymentState(
    functionName: "pauseEmployment" | "resumeEmployment",
    userKey: Address,
  ) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    const hash = await operator.wallet.writeContract({
      address: manager,
      abi: managerAbi,
      functionName,
      args: [userKey],
      account: operator.account,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  private async requireSuccess(hash: Hash) {
    const receipt = await this.client().waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw Errors.chargeFailed("Transaction reverted on-chain");
    }
  }
}

export const blockchainService = new BlockchainService();
