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
    name: "credit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function operatorKey(): Hex | null {
  const raw = process.env.SENTRY_OPERATOR_KEY ?? process.env.PRIVATE_KEY;
  if (!raw?.trim()) return null;
  const key = raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`;
  return key as Hex;
}

/** Celo Mainnet only. */
export class BlockchainService {
  connect() {
    return {
      connected: true,
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

  getBalance(address?: string) {
    return {
      address: address ?? "0x0000000000000000000000000000000000000000",
      balance: "0",
      currency: "CELO",
    };
  }

  async getEmploymentBalance(address: string) {
    const contractAddress = this.contractAddress();
    if (!contractAddress || !isAddress(address)) {
      return null;
    }

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

  /** Operator charge for completed work. Returns tx hash or null if unavailable. */
  async chargeOnChain(input: {
    account: Address;
    amountCusd: number;
    actionId: Hex;
  }): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;

    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "charge",
      args: [input.account, parseEther(input.amountCusd.toString()), input.actionId],
      account: op.account,
      chain: celo,
    });
    await this.client().waitForTransactionReceipt({ hash: hash as Hash });
    return hash;
  }

  async pauseOnChain(account: Address): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "pause",
      args: [account],
      account: op.account,
      chain: celo,
    });
    return hash;
  }

  async resumeOnChain(account: Address): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "resume",
      args: [account],
      account: op.account,
      chain: celo,
    });
    return hash;
  }

  async creditOnChain(account: Address, amountCusd: number): Promise<string | null> {
    const op = await this.operatorWallet();
    if (!op) return null;
    const hash = await op.wallet.writeContract({
      address: op.address,
      abi: employmentAbi,
      functionName: "credit",
      args: [account, parseEther(amountCusd.toString())],
      account: op.account,
      chain: celo,
    });
    return hash;
  }
}

export const blockchainService = new BlockchainService();
