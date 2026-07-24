/**
 * Shared helpers: read/write accounts.json and top-up a wallet from FUNDER.
 */

import { createWalletClient, http, publicActions, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { abi, address } from "../deployments/celo/Vibeplay.json";
import fs from "fs";
import path from "path";

export const VIBEPLAY_ADDRESS = address;
export const VIBEPLAY_ABI = abi;
export const RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
export const ACCOUNTS_FILE = path.resolve(__dirname, "accounts.json");

export interface StoredAccount {
  address: string;
  private_key: `0x${string}`;
  date_created: string;
  last_run: string | null;
}

export function readAccounts(): StoredAccount[] {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8")) as StoredAccount[];
  } catch {
    return [];
  }
}

export function writeAccounts(accounts: StoredAccount[]) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
}

/** Mark last_run for an account and persist. */
export function touchLastRun(accounts: StoredAccount[], address: string) {
  const acc = accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  if (acc) acc.last_run = new Date().toISOString();
  writeAccounts(accounts);
}

/** Returns true if last_run was less than 5 minutes ago. */
export function ranRecently(account: StoredAccount): boolean {
  if (!account.last_run) return false;
  const diff = Date.now() - new Date(account.last_run).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes in ms
}

/** Pick `count` random accounts from the list. */
export function pickRandom(accounts: StoredAccount[], count: number): StoredAccount[] {
  const shuffled = [...accounts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Parse --count N from process.argv */
export function parseCount(): number {
  const idx = process.argv.indexOf("--count");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("❌  Usage: bun run <script> --count <N>");
    process.exit(1);
  }
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n <= 0) {
    console.error("❌  --count must be a positive integer");
    process.exit(1);
  }
  return n;
}

/**
 * Transfer CELO from FUNDER_KEY to `toAddress` if its balance < requiredBalance.
 * Returns true if balance is already sufficient or top-up succeeded.
 */
export async function topUpIfNeeded(
  toAddress: `0x${string}`,
  requiredBalance: bigint
): Promise<boolean> {
  const funderKeyRaw = (process.env.FUNDER_KEY || "").trim();
  if (!funderKeyRaw) {
    console.error("    ❌  FUNDER_KEY not set in env — required to top up accounts for gas.");
    return false;
  }
  const funderKey = (
    funderKeyRaw.startsWith("0x") ? funderKeyRaw : `0x${funderKeyRaw}`
  ) as `0x${string}`;

  const funderAccount = privateKeyToAccount(funderKey);
  const client = createWalletClient({
    account: funderAccount,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  const balance = await client.getBalance({ address: toAddress });
  if (balance >= requiredBalance) return true; // already sufficient

  const missing = requiredBalance - balance;
  const topUpAmount = missing;

  const funderBalance = await client.getBalance({ address: funderAccount.address });
  if (funderBalance < topUpAmount) {
    console.warn(`    ⚠️  Funder has insufficient balance for top-up (${formatEther(funderBalance)} CELO, needed ${formatEther(topUpAmount)} CELO). Skipping.`);
    return false;
  }

  console.log(`    💸  Balance low (${formatEther(balance)} CELO). Topping up with ${formatEther(topUpAmount)} CELO...`);
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

/** Parse --wait N from process.argv. Defaults to 0 if not provided. */
export function parseWait(): number {
  const idx = process.argv.indexOf("--wait");
  if (idx === -1 || !process.argv[idx + 1]) {
    return 0;
  }
  const n = parseInt(process.argv[idx + 1], 10);
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

export type Address = `0x${'0000000000000000000000000000000000000000'}`;

export interface Analytics {
  totalProcessedFigure: bigint;
  totalWins: bigint;
}

export interface GetData {
  usdm: Address;
  treasury: Address;
  userAllowance: bigint;
  feeRate: bigint;
  currentRoundId: bigint;
  riskThreshold: bigint;
  lockTime: bigint;
  forwarder: Address;
  needAutomation: boolean;
  rounds: Round[];
  currentRound: Round;
  userPredictions: UserPrediction[];
  analaytics: Analytics;
  useCelo: boolean;
}
    
export interface UserPrediction {
  roundId: bigint;
  amount: bigint;
  predictsHigher: boolean;
  hasClaimed: boolean;
}

export interface Round {
  amountOut: bigint;
  id: bigint;
  startTime: bigint;
  lockTime: bigint;
  totalPool: bigint;
  totalHigherStaked: bigint;
  totalLowerStaked: bigint;
  startPrice: bigint;
  closePrice: bigint;
  isSettled: boolean;
  result: number;
  stage: number;
  topContributors: Address[];
  topContributions: bigint[];
  participants: Address[];
  rewardPool: bigint;
  useCelo:boolean;
}
    




// Ran command: `bun run predict --count 10 --fund true`
// Viewed package.json:1-68
// Viewed perform-check.ts:1-153
// Viewed generate-wallets.ts:1-183

// Here are the commands and arguments to run each of the four tester scripts:

// ### 1. Generate Tester Wallets
// Generates new EVM-compatible wallets and saves them to [`accounts.json`](file:///c:/Users/HP/Desktop/proofOfShip/vibecheck/smartContracts/tester/accounts.json).
// ```bash
// # Fund the newly generated wallets (default behavior)
// bun run generate --count 5 --fund true

// # Skip funding (only generate wallets and save metadata)
// bun run generate --count 5 --fund false
// ```
// * **Arguments:**
//   * `--count <N>`: *(Required)* Number of wallets to generate.
//   * `--fund <true|false>`: *(Optional, defaults to true)* Whether to fund the new wallets from the funder address.

// ---

// ### 2. Place Predictions
// Picks random wallets, dynamically estimates gas, tops them up with the exact CELO needed, and calls `placePrediction()`.
// ```bash
// bun run predict --count 3 --wait 10
// ```
// * **Arguments:**
//   * `--count <N>`: *(Required)* Number of accounts to use.
//   * `--wait <seconds>`: *(Optional, defaults to 0)* Time to wait before moving to the next account.

// ---

// ### 3. Claim Winnings
// Checks accounts for settled unclaimed predictions, dynamically estimates gas (using zero-gas-price simulation to bypass balance checks), tops up exactly what is needed, and calls `claimWinnings()`.
// ```bash
// bun run claim --count 3 --wait 5
// ```
// * **Arguments:**
//   * `--count <N>`: *(Required)* Number of accounts to check.
//   * `--wait <seconds>`: *(Optional, defaults to 0)* Time to wait before moving to the next account.

// ---

// ### 4. Perform Upkeep
// Checks if contract upkeep is needed (e.g. if the round lock time has been reached) and executes the upkeep to transition or settle the game round.
// ```bash
// bun run check --count 1
// ```
// * **Arguments:**
//   * `--count <N>`: *(Required)* Number of accounts to check/use.

// bun run fund --count 3 --amount 0.05


// Hey ChatGPT, In this conversation is an attached copy of my project. To explain better, this is my final year project in the National Open University of Nigeria. The topic of the project is ...... . After submitting to my project supervisor severally, she eventually commented on my project adding it is not well-written and well-presented. Every paragraphs that were wrong are strikes out in the document. Her comment on what to correct are in red inks but not strike-through. 



// Since you're the best at writing and supervising project, based on the topic, I want you to vividly scrutinize the project for every thing that are wrong, represent them to look presentation for a project submission. You do not have to completely rewrite from scratch since the supervisor already have the knowledge of what I wrote, changing it would only worsen the situation. The actual topic of the project is `ASSESSMENT OF RESOURCES FOR TEACHING AND LEARNING BIOLOGY`. Ensure to provide valid references, not just some links and that does not exist. Avoid using too much of tough and big vocabularies. The tone must no be too formal. Use tone that sounds more like a college student. Avoid using unrealistic methods and facts.



// The part marked as `****Include the location` should contain the location where the research/sample survey was conducted or carried out. Use realistic location. I planned to use schools in Ijebu-ode, Ogun State, Nigeria for conducting the survey.
// http://localhost:3000/?game=duel&join=12