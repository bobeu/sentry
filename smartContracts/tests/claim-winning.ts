/**
 * Script 4: claim-winning.ts
 *
 * Picks `count` random accounts from accounts.json and calls
 * `claimWinnings(uint256 roundId)` on the Vibeplay contract for each one.
 *
 * - Skips any account whose last_run was < 5 minutes ago.
 * - Reads the current round from `getData()` and attempts to claim for the
 *   most recent settled round that the account participated in.
 * - Estimates gas before broadcasting; tops up 0.05 CELO from FUNDER if needed.
 * - Updates last_run for every account that successfully broadcasts.
 *
 * Usage: bun run tester:claim --count 3
 */

import {
  createWalletClient,
  http,
  publicActions,
  formatEther,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import "dotenv/config";
import {
  readAccounts,
  touchLastRun,
  ranRecently,
  pickRandom,
  parseCount,
  parseWait,
  sleep,
  topUpIfNeeded,
  RPC_URL,
  VIBEPLAY_ABI,
  VIBEPLAY_ADDRESS,
  GetData,
} from "./utils";
import { privateKeyToAccount } from "viem/accounts";

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.error("❌  FUNDER_KEY not set in .env (used by topUpIfNeeded for gas)");
    process.exit(1);
  }

  const useAll = process.argv.includes("--all");
  const waitSecs = parseWait();
  const allAccounts = readAccounts();

  if (allAccounts.length === 0) {
    console.error("❌  No accounts in storage. Run tester:generate first.");
    process.exit(1);
  }

  // let selected: typeof allAccounts;
  let selected = allAccounts;
  // if (useAll) {
  //   selected = allAccounts;
  // } else {
  //   const count = parseCount();
  //   selected = pickRandom(allAccounts, count);
  // }
  console.log(`\n🏆  claimWinnings — using ${selected.length} of ${allAccounts.length} stored account(s)\n`);

  for (const storedAcc of selected) {
    console.log(`─── Account: ${storedAcc.address} ────────────────────`);

    // Skip if ran recently
    // if (ranRecently(storedAcc)) {
    //   console.log(`    ⏭️  Skipped — last_run was < 5 min ago (${storedAcc.last_run})\n`);
    //   continue;
    // }

    const privateKey = storedAcc.private_key as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    const client = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    }).extend(publicActions);

    try {
      // ── 1. Fetch contract data to find claimable rounds ────────────────────
      const data = await client.readContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "getData",
        args: [account.address as Address],
      }) as GetData;

      // let round : number = 0
      // Find the first settled round in the returned window that:
      //   - has stage == CLAIMWINNING (1)
      //   - the user has a non-zero prediction that hasn't been claimed yet
      // if(data.currentRoundId === 0n) {
      //   console.log(`No active round. Current round is ${data.currentRoundId.toString()}`);
      //   return;
      // }
      // round = Number(data.currentRoundId - 1n);
      const rounds = data.rounds || [];
      const userPredictions = data.userPredictions || [];

      let targetRoundId: bigint | null = null;

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        const pred = userPredictions[i];

        if (!round || !pred) continue;
        if (!round.isSettled) continue;
        if (round.stage !== 1) continue; // Stage.CLAIMWINNING == 1
        if (pred.amount === 0n) continue;
        if (pred.hasClaimed) {
          console.log(`    ℹ️  Round ${round.id} — already claimed. Skipping.`);
          continue;
        }

        // ── 2. Estimate gas using gasPrice: 0n to bypass balance check ─────────
        let gasEstimate: bigint;
        console.log(`  ${account.address.slice(0, 12)} 🎯  Claiming winnings for round ${round.id}...`);
        
        gasEstimate = await client.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "claimWinnings",
          args: [round.id],
          account,
          gasPrice: 0n,
        });
  
        const gasPrice = await client.getGasPrice();
        const gasEstimateWithOverhead = (gasEstimate * 100n) / 100n; // 1% overhead
        const gasCost = gasEstimateWithOverhead * gasPrice;
        console.log(`    ⛽  Gas estimate: ${gasEstimate} units (+20% overhead)  ≈ ${formatEther(gasCost)} CELO`);
      
        
        // ── 3. Top-up if needed ────────────────────────────────────────────────
        const funded = await topUpIfNeeded(account.address as `0x${string}`, gasCost);
        if (!funded) {
          console.log(`    ❌  Cannot fund account for gas cost. Skipping.\n`);
          continue;
        }

        // ── 4. Broadcast claimWinnings ─────────────────────────────────────────
        const txHash = await client.writeContract({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "claimWinnings",
          args: [round.id],
          gas: gasEstimateWithOverhead,
          gasPrice,
        });

        console.log(`    📡  Sent! tx: ${txHash}`);
        
        const receipt = await client.waitForTransactionReceipt({ hash: txHash });
        console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

        // targetRoundId = round.id;
        // break;
      }

      // if (targetRoundId === null) {
      //   console.log(`    ⚠️  No claimable rounds found for this account. Skipping.\n`);
      //   continue;
      // }

      // ── 5. Update last_run ─────────────────────────────────────────────────
      touchLastRun(allAccounts, storedAcc.address);

      if (waitSecs > 0) {
        console.log(`    ⏳  Waiting ${waitSecs} seconds before the next account...`);
        await sleep(waitSecs);
      }
    } catch (err: any) {
      console.error(`    ❌  Unexpected error: ${err?.message || err?.data?.message || err}`);
    }
  }

  console.log("✅  claim-winning run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
