/**
 * Script 2: place-prediction.ts
 *
 * Picks `count` random accounts from accounts.json and calls
 * `placePrediction(bool _predictsHigher, uint256 _amount)` on the
 * Vibeplay contract for each one.
 *
 * - Skips any account whose last_run was < 5 minutes ago.
 * - Estimates gas before broadcasting; if balance < gas cost, tops up
 *   0.05 CELO from FUNDER first.
 * - Updates last_run for every account that successfully broadcasts.
 *
 * Usage: bun run tester:predict --count 5
 */
import crypto from "crypto";
import {
  createWalletClient,                                                                                       
  http,
  publicActions,
  parseEther,
  formatEther,
  parseAbi,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
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
  VIBEPLAY_ADDRESS,
  VIBEPLAY_ABI,
  GetData
} from "./utils";

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const FUNDER_KEY = (process.env.FUNDER_KEY || "").trim() as `0x${string}`;
  if (!FUNDER_KEY) {
    console.error("❌  FUNDER_KEY not set in .env");
    process.exit(1);
  }
  const funderAccount = privateKeyToAccount(
    (FUNDER_KEY.startsWith("0x") ? FUNDER_KEY : `0x${FUNDER_KEY}`) as `0x${string}`,
  );

  const useAll = process.argv.includes("--all");
  // const waitSecs = parseWait();
  const waitSecs: number | undefined = undefined; // Comment out this line if you uncomment the parseWait line above
  const allAccounts = readAccounts();

  if (allAccounts.length === 0) {
    console.error("❌  No accounts in storage. Run tester:generate first.");
    process.exit(1);
  }

  let selected: typeof allAccounts;
  if (useAll) {
    selected = allAccounts;
  } else {
    const count = parseCount();
    selected = pickRandom(allAccounts, count);
  }
  console.log(`\n🎯  placePrediction — using ${selected.length} of ${allAccounts.length} stored account(s)\n`);

  for (const storedAcc of selected) {
    console.log(`─── Account: ${storedAcc.address} ────────────────────`);

    // Skip if ran recently
    // if (ranRecently(storedAcc)) {
    //   console.log(`    ⏭️  Skipped — last_run was < 5 min ago (${storedAcc.last_run})\n`);
    //   continue;
    // }

    const privateKey = storedAcc.private_key as `0x${string}`;
    if(!privateKey) {
      console.log(`    ⏭️  Skipped — Private key for ${storedAcc.address} not found ${storedAcc.private_key})\n`);
      continue;
    }
    console.log("Private key: ", privateKey.slice(0, 20), privateKey.length);
    const account = privateKeyToAccount(privateKey);

    const client = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    }).extend(publicActions);

    try {
      // ── 1. Fetch contract state to pick amount & direction ──────────────────
      const data = await client.readContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "getData",
        args: [account.address as Address],
      }) as GetData;

      // console.log("data.rounds[1].totalPool: ", data.rounds[1].totalPool.toString());
      // console.log("data.rounds[1].amountOut: ", data.rounds[1].amountOut.toString());
      // console.log("data.rounds[2].totalPool: ", data.rounds[2].totalPool.toString());
      // console.log("data.rounds[2].amountOut: ", data.rounds[2].amountOut.toString());
      // console.log("data.rounds[3].totalPool: ", data.rounds[3].totalPool.toString());
      // console.log("data.rounds[3].amountOut: ", data.rounds[3].amountOut.toString());

      const currentRound = data.currentRound;
      if (currentRound.isSettled) {
        console.log(`    ⚠️  Current round is already settled. Skipping.\n`);
        continue;
      }
      if (currentRound.stage !== 0) {
        console.log(`    ⚠️  Round not in PLACEPREDICTION stage (stage=${currentRound.stage}). Skipping.\n`);
        continue;
      }

      // Check the user hasn't already predicted
      const existingPrediction = data.userPredictions?.[0];
      if (existingPrediction && existingPrediction.amount > 0n) {
        console.log(`    ⚠️  Already predicted in this round. Skipping.\n`);
        continue;
      }

      // Cryptographically secure random small CELO amount (0.001 – 0.05 CELO)
      const randomBuf = crypto.randomBytes(5);
      const randomFloat = randomBuf.readUInt32LE(0) / 4294967295;
      const amountEth = Math.round((randomFloat * (0.06 - 0.001) + 0.001) * 1_000_000) / 1_000_000;
      const amount = parseEther(amountEth.toString());
      // Cryptographically secure random prediction direction (50% chance of higher or lower)
      const predictsHigher = randomBuf[4] >= 128;

      console.log(`    🎲  predictsHigher=${predictsHigher}  amount=${formatEther(amount)} CELO`);

      // ── 2. Estimate gas using funder's account to know exact cost ──────────
      let gasEstimate: bigint;
      try {
        gasEstimate = await client.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "placePrediction",
          args: [predictsHigher, amount],
          value: amount,
          account: funderAccount,
        });
        console.log(`Gas estimate: ${gasEstimate.toString()}`);
      } catch (err: any) {
        console.error(`    ❌  Gas estimation failed: ${err.message}\n`);
        continue;
      }

      const gasPrice = await client.getGasPrice();
      const gasEstimateWithOverhead = (gasEstimate * 100n) / 100n;
      const gasCost = gasEstimateWithOverhead * gasPrice;
      const totalRequired = amount + gasCost;

      console.log(`    ⛽  Gas estimate: ${gasEstimate} units (+0% overhead)  ≈ ${formatEther(gasCost)} CELO`);

      // ── 3. Top-up if needed ────────────────────────────────────────────────
      const funded = await topUpIfNeeded(account.address as `0x${string}`, totalRequired);
      if (!funded) {
        console.log(`    ❌  Cannot fund account. Skipping.\n`);
        continue;
      }

      console.log(`NOW RUNNING TRX FROM ${account.address}.\n`);
      // ── 4. Broadcast ───────────────────────────────────────────────────────
      const txHash = await client.writeContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "placePrediction",
        args: [predictsHigher, amount],
        value: amount,
        gas: gasEstimateWithOverhead,
        gasPrice,
      });

      console.log(`    📡  Sent! tx: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

      // ── 5. Update last_run ─────────────────────────────────────────────────
      touchLastRun(allAccounts, storedAcc.address);

      const delay = waitSecs !== undefined ? waitSecs : Math.floor(Math.random() * 20) + 1;
      if (delay > 0) {
        console.log(`    ⏳  Waiting ${delay} seconds before the next account...`);
        await sleep(delay);
      }
    } catch (err: any) {
      console.error(`    ❌  Unexpected error: ${err.message}`);
    }

    console.log();
  }

  console.log("✅  place-prediction run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
