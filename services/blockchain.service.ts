import {
  createPublicClient,
  formatEther,
  http,
  isAddress,
  type Address,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
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
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

export class BlockchainService {
  connect() {
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "42220");
    return {
      connected: true,
      network: chainId === 11142220 ? "celo-sepolia" : "celo-mainnet",
      chainId,
      employmentContract: CONTRACTS.EmploymentContract.address ?? null,
    };
  }

  private client() {
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "42220");
    const chain = chainId === 11142220 ? celoSepolia : celo;
    const rpc =
      process.env.CELO_RPC ??
      (chainId === 11142220
        ? "https://forno.celo-sepolia.celo-testnet.org"
        : "https://forno.celo.org");

    return createPublicClient({
      chain,
      transport: http(rpc),
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
      const client = this.client();
      const raw = await client.readContract({
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
