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
import { normalizePrivateKey } from "./keys";
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

export { normalizePrivateKey } from "./keys";

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

function resolveFunderKey(): Hex {
  const raw = (process.env.FUNDER_KEY || "").trim();
  if (!raw) {
    throw new Error(
      "FUNDER_KEY not set in env — required to top up accounts for gas.",
    );
  }
  return normalizePrivateKey(raw, "FUNDER_KEY");
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

export type EstimatedTxFees = {
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasCost: bigint;
  required: bigint;
};

/**
 * Estimate gas + EIP-1559 fees for a contract call *before* sending.
 * Tops up the signer via FUNDER_KEY to cover the estimated max cost, then
 * re-checks balance. Returns null when the estimate itself fails or the tx
 * cannot be funded — callers must not send in that case.
 */
export async function estimateAndTopUpForContract(input: {
  account: Account;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}): Promise<EstimatedTxFees | null> {
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
    console.error(
      `    ❌  Estimate failed for ${input.functionName}: ${err?.message ?? err}`,
    );
    return null;
  }

  const fees = await client.estimateFeesPerGas().catch(() => null);
  const networkGasPrice = await client.getGasPrice();
  // Use the fees we will attach to writeContract so cost prediction matches reservation.
  const maxFeePerGas = fees?.maxFeePerGas ?? networkGasPrice * 2n;
  const maxPriorityFeePerGas =
    fees?.maxPriorityFeePerGas ??
    (maxFeePerGas > networkGasPrice ? maxFeePerGas - networkGasPrice : 1n);
  const gas = (gasEstimate * 101n) / 100n;
  const gasCost = gas * maxFeePerGas;
  // 10% buffer between estimate and send for fee-market movement.
  const required = ((gasCost + (input.value ?? 0n)) * 110n) / 100n;

  const signer = input.account.address as `0x${string}`;
  const balanceBefore = await client.getBalance({ address: signer });
  console.log(
    `    ⛽  Estimate ${input.functionName}: gas=${gasEstimate} (+1%) maxFeePerGas=${maxFeePerGas.toString()}wei cost≈${formatEther(gasCost)} need≈${formatEther(required)} (bal ${formatEther(balanceBefore)})`,
  );

  if (balanceBefore < required) {
    const funded = await topUpIfNeeded(signer, required);
    if (!funded) {
      console.error(
        `    ❌  Preflight: cannot cover estimated cost ${formatEther(required)} CELO for ${input.functionName}. Not sending.`,
      );
      return null;
    }
  }

  const balanceAfter = await client.getBalance({ address: signer });
  if (balanceAfter < required) {
    console.error(
      `    ❌  Preflight: balance ${formatEther(balanceAfter)} < estimated need ${formatEther(required)} CELO after top-up. Not sending.`,
    );
    return null;
  }

  console.log(
    `    ✅  Preflight ok for ${input.functionName} (bal ${formatEther(balanceAfter)} ≥ ${formatEther(required)} CELO)`,
  );

  return {
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasCost,
    required,
  };
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
