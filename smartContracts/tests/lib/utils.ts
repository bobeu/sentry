/**
 * Shared helpers for volume / transaction scripts.
 * Contract ABIs + addresses are loaded from hardhat deployments so redeploys stay in sync.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  formatEther,
  type Abi,
  type Account,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import {
  abi as eAbi,
  address as eAddress,
} from "../../deployments/celo/EmploymentManager.json";
import {
  abi as swfAbi,
  address as swfAddress,
} from "../../deployments/celo/SentryWalletFactory.json";
import { address as rfAddress } from "../../deployments/celo/RewardFactory.json";
import rewardFactory from "../../artifacts/contracts/RewardFactory.sol/RewardFactory.json";
import reward from "../../artifacts/contracts/RewardAccount.sol/RewardAccount.json";
import fs from "fs";
import path from "path";

export const EMPLOYMENT_MANAGER_ABI = eAbi as Abi;
export const SENTRY_WALLET_FACTORY_ABI = swfAbi as Abi;
/** Prefer Hardhat artifact ABI so local contract changes apply before redeploy. */
export const REWARD_FACTORY_ABI = rewardFactory.abi as Abi;
export const REWARD_ACCOUNT_ABI = reward.abi as Abi;

export const EMPLOYMENT_MANAGER_ADDRESS = eAddress as Address;
export const SENTRY_WALLET_FACTORY_ADDRESS = swfAddress as Address;
export const REWARD_FACTORY_ADDRESS = rfAddress as Address;

/** Convenience bundle matching the old lib/contracts shape. */
export const CONTRACTS = {
  EmploymentManager: {
    address: EMPLOYMENT_MANAGER_ADDRESS,
    abi: EMPLOYMENT_MANAGER_ABI,
  },
  SentryWalletFactory: {
    address: SENTRY_WALLET_FACTORY_ADDRESS,
    abi: SENTRY_WALLET_FACTORY_ABI,
  },
  RewardFactory: {
    address: REWARD_FACTORY_ADDRESS,
    abi: REWARD_FACTORY_ABI,
  },
} as const;

export const RPC_URL = process.env.CELO_RPC_URL || process.env.CELO_RPC || "https://forno.celo.org";
export const ACCOUNTS_FILE = path.resolve(__dirname, "..", "accounts.json");

export interface StoredAccount {
  address: string;
  private_key: `0x${string}`;
}

export function readAccounts(): StoredAccount[] {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8")) as StoredAccount[];
  } catch {
    return [];
  }
}

/** Pick `count` random accounts from the list. */
export function pickRandom(accounts: StoredAccount[], count: number): StoredAccount[] {
  const shuffled = [...accounts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, accounts.length));
}

/** Parse --count N from process.argv */
export function parseCount(): number {
  const idx = process.argv.indexOf("--count");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("❌  Usage: bun run <script> --count <N>");
    process.exit(1);
  }
  const n = parseInt(process.argv[idx + 1]!, 10);
  if (isNaN(n) || n <= 0) {
    console.error("❌  --count must be a positive integer");
    process.exit(1);
  }
  return n;
}

function resolveFunderKey(): `0x${string}` {
  const raw = (process.env.FUNDER_KEY || "").trim();
  if (!raw) {
    throw new Error(
      "FUNDER_KEY not set in env — required to top up accounts for gas.",
    );
  }
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

/**
 * Transfer CELO from FUNDER_KEY to `toAddress` if its balance < requiredBalance.
 * Returns true if balance is already sufficient or top-up succeeded.
 */
export async function topUpIfNeeded(
  toAddress: `0x${string}`,
  requiredBalance: bigint,
): Promise<boolean> {
  let funderKey: `0x${string}`;
  try {
    funderKey = resolveFunderKey();
  } catch (err: any) {
    console.error(`    ❌  ${err.message}`);
    return false;
  }

  const funderAccount = privateKeyToAccount(funderKey);
  const client = createWalletClient({
    account: funderAccount,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  const balance = await client.getBalance({ address: toAddress });
  if (balance >= requiredBalance) return true;

  const topUpAmount = requiredBalance - balance;
  const funderBalance = await client.getBalance({ address: funderAccount.address });
  if (funderBalance < topUpAmount) {
    console.warn(
      `    ⚠️  Funder has insufficient balance for top-up (${formatEther(funderBalance)} CELO, needed ${formatEther(topUpAmount)} CELO). Skipping.`,
    );
    return false;
  }

  console.log(
    `    💸  Balance low (${formatEther(balance)} CELO). Topping up with ${formatEther(topUpAmount)} CELO...`,
  );
  try {
    const txHash = await client.sendTransaction({ to: toAddress, value: topUpAmount });
    await client.waitForTransactionReceipt({ hash: txHash });
    console.log(`    ✅  Top-up confirmed: ${txHash}`);
    return true;
  } catch (err: any) {
    console.error(`    ❌  Top-up failed: ${err.message}`);
    return false;
  }
}

/**
 * Estimate gas for a contract call, ensure the signer has enough CELO (top-up via FUNDER_KEY),
 * and return gas limit (+1% overhead) for the write.
 */
export async function estimateAndTopUpForContract(input: {
  account: Account;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}): Promise<{ gas: bigint; gasPrice: bigint; gasCost: bigint } | null> {
  const client = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });

  let gasEstimate: bigint;
  try {
    gasEstimate = await client.estimateContractGas({
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args as never,
      value: input.value,
      account: input.account,
      // Bypass local balance checks during estimation (same pattern as claim-winning-round).
      gasPrice: 0n,
    });
  } catch (err: any) {
    console.error(`    ❌  Gas estimation failed: ${err?.message ?? err}`);
    return null;
  }

  const gasPrice = await client.getGasPrice();
  const gas = (gasEstimate * 101n) / 100n;
  const gasCost = gas * gasPrice;
  const required = gasCost + (input.value ?? 0n);

  console.log(
    `    ⛽  Gas estimate: ${gasEstimate} units (+1% overhead) ≈ ${formatEther(gasCost)} CELO`,
  );

  const funded = await topUpIfNeeded(input.account.address as `0x${string}`, required);
  if (!funded) {
    console.log(`    ❌  Cannot fund account for gas cost. Skipping.`);
    return null;
  }

  return { gas, gasPrice, gasCost };
}

/** Parse --wait N from process.argv. Defaults to 0 if not provided. */
export function parseWait(): number {
  const idx = process.argv.indexOf("--wait");
  if (idx === -1 || !process.argv[idx + 1]) {
    return 0;
  }
  const n = parseInt(process.argv[idx + 1]!, 10);
  if (isNaN(n) || n < 0) {
    console.error("❌  --wait must be a non-negative integer (seconds)");
    process.exit(1);
  }
  return n;
}

/** Simple sleep helper in seconds */
export function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export type { Address, Hex };
