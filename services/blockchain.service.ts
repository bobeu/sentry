import {
  createPublicClient,
  formatEther,
  http,
  isAddress,
  type Address,
} from "viem";
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
] as const;

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

  getBalance(address?: string) {
    return {
      address: address ?? "0x0000000000000000000000000000000000000000",
      balance: "0",
      currency: "CELO",
    };
  }

  async getEmploymentBalance(address: string) {
    const contractAddress = CONTRACTS.EmploymentContract.address;
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
}

export const blockchainService = new BlockchainService();
