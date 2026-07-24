/**
 * Script 3: perform-check.ts
 *
 * Picks `count` random accounts from accounts.json and calls
 * `performUpkeep(bytes)` on the Vibeplay contract for each one.
 * (Referred to as "performCheck" in the task spec — this is the
 * Chainlink Automation function that settles the current round.)
 *
 * - Skips any account whose last_run was < 5 minutes ago.
 * - Estimates gas before broadcasting; tops up 0.05 CELO from FUNDER if needed.
 * - Updates last_run for every account that successfully broadcasts.
 *
 * Usage: bun run tester:check --count 3
 */

import {
  createWalletClient,
  http,
  publicActions,
  formatEther,
  parseAbi,
} from "viem";
import { celo } from "viem/chains";
import "dotenv/config";
import {
  readAccounts,
  touchLastRun,
  ranRecently,
  pickRandom,
  parseCount,
  topUpIfNeeded,
  RPC_URL,
  VIBEPLAY_ADDRESS,
} from "./utils";
import { privateKeyToAccount } from "viem/accounts";

// ─── Vibeplay ABI (performUpkeep + checkUpkeep) ──────────────────────────────

const VIBEPLAY_ABI = parseAbi([
  "function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData)",
  "function performUpkeep(bytes calldata performData) external",
]);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.error("❌  FUNDER_KEY not set in .env (used by topUpIfNeeded for gas)");
    process.exit(1);
  }

  const count = parseCount();
  const allAccounts = readAccounts();

  if (allAccounts.length === 0) {
    console.error("❌  No accounts in storage. Run tester:generate first.");
    process.exit(1);
  }

  const selected = pickRandom(allAccounts, count);
  console.log(`\n🔍  performCheck (performUpkeep) — using ${selected.length} of ${allAccounts.length} stored account(s)\n`);

  for (const storedAcc of selected) {
    console.log(`─── Account: ${storedAcc.address} ────────────────────`);

    // Skip if ran recently
    if (ranRecently(storedAcc)) {
      console.log(`    ⏭️  Skipped — last_run was < 5 min ago (${storedAcc.last_run})\n`);
      continue;
    }

    const privateKey = storedAcc.private_key as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    const client = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    }).extend(publicActions);

    try {
      // ── 1. Check if upkeep is needed ───────────────────────────────────────
      const [upkeepNeeded] = await client.readContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "checkUpkeep",
        args: ["0x"],
      }) as [boolean, `0x${string}`];

      if (!upkeepNeeded) {
        console.log(`    ⚠️  checkUpkeep returned false — round lock time not reached yet. Skipping.\n`);
        continue;
      }

      console.log(`    ✅  checkUpkeep: upkeep needed. Proceeding to performUpkeep...`);

      // ── 2. Estimate gas ────────────────────────────────────────────────────
      let gasEstimate: bigint;
      try {
        gasEstimate = await client.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "performUpkeep",
          args: ["0x"],
          account,
        });
      } catch (err: any) {
        console.error(`    ❌  Gas estimation failed: ${err.message}\n`);
        continue;
      }

      const gasPrice = await client.getGasPrice();
      const gasEstimateWithOverhead = (gasEstimate * 120n) / 100n;
      const gasCost = gasEstimateWithOverhead * gasPrice;
      console.log(`    ⛽  Gas estimate: ${gasEstimate} units (+20% overhead)  ≈ ${formatEther(gasCost)} CELO`);

      // ── 3. Top-up if needed ────────────────────────────────────────────────
      const funded = await topUpIfNeeded(account.address as `0x${string}`, gasCost);
      if (!funded) {
        console.log(`    ❌  Cannot fund account. Skipping.\n`);
        continue;
      }

      // ── 4. Broadcast performUpkeep ─────────────────────────────────────────
      const txHash = await client.writeContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "performUpkeep",
        args: ["0x"],
        gas: gasEstimateWithOverhead,
        gasPrice,
      });

      console.log(`    📡  Sent! tx: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

      // ── 5. Update last_run ─────────────────────────────────────────────────
      touchLastRun(allAccounts, storedAcc.address);
    } catch (err: any) {
      console.error(`    ❌  Unexpected error: ${err.message}`);
    }

    console.log();
  }

  console.log("✅  perform-check run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
