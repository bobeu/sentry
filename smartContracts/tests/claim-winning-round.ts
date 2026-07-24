import {
  createWalletClient,
  http,
  publicActions,
  formatEther,
  type Address,
  zeroAddress,
} from "viem";
import { celo } from "viem/chains";
import "dotenv/config";
import {
  readAccounts,
  touchLastRun,
  // ranRecently,
  pickRandom,
  parseCount,
  // parseWait,
  sleep,
  topUpIfNeeded,
  RPC_URL,
  VIBEPLAY_ABI,
  VIBEPLAY_ADDRESS,
  Round,
  GetData,
} from "./utils";
import { privateKeyToAccount } from "viem/accounts";

function parseRound(): bigint {
  const idx = process.argv.indexOf("--round");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("❌  Usage: bun run <script> --round <N> [--count <M> | --all]");
    process.exit(1);
  }
  try {
    const n = BigInt(process.argv[idx + 1]);
    if (n < 0n) {
      throw new Error("--round must be a non-negative integer");
    }
    if (n === 0n) {
      throw new Error("Round must be greater than zero");
    }
    return n;
  } catch (error: any) {
    console.error(`❌ ${error?.message || error?.data?.message || error.cause || error.reason || error} `);
    process.exit(1);
  }
}

async function main() {
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.error("❌  FUNDER_KEY not set in .env (used by topUpIfNeeded for gas)");
    process.exit(1);
  }

  // const roundId = parseRound();
  let roundId : bigint = 0n;
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
  console.log(`\n🏆  claimWinningsRound — Round: ${roundId} — using ${selected.length} of ${allAccounts.length} stored account(s)\n`);

  // 1. Fetch round state once to verify it is settled and in claim stage
  const clientFunder = createWalletClient({
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  try {
    const data = await clientFunder.readContract({
      address: VIBEPLAY_ADDRESS,
      abi: VIBEPLAY_ABI,
      functionName: "getData",
      args: [zeroAddress],
    }) as GetData;

    if (data.currentRoundId === 0n) {
      console.log(` Round is ${data.currentRoundId.toString()}`);
      return;
    }

    roundId = data.currentRoundId - 1n;
    // roundId = 4n;
    const round = await clientFunder.readContract({
      address: VIBEPLAY_ADDRESS,
      abi: VIBEPLAY_ABI,
      functionName: "getRound",
      args: [roundId],
    }) as Round;

    if (!round.isSettled) {
      console.error(`❌  Round ${roundId} is not settled yet. Cannot claim winnings.`);
      process.exit(1);
    }
    if (Number(round.stage) !== 1) { // Stage.CLAIMWINNING == 1
      console.error(`❌  Round ${roundId} is not in CLAIMWINNING stage (current stage: ${round.stage}). Cannot claim winnings.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌  Failed to fetch round data for round ${roundId}: ${err.message}`);
    process.exit(1);
  }

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
      // 2. Fetch user prediction info for the round
      const [, amount, , hasClaimed] = await client.readContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "getUserPrediction",
        args: [roundId, account.address],
      }) as [boolean, bigint, boolean, boolean];

      if (amount === 0n) {
        console.log(`    ⚠️  Account did not predict in round ${roundId}. Skipping.\n`);
        continue;
      }
      if (hasClaimed) {
        console.log(`    ℹ️  Winnings/refunds for round ${roundId} already claimed. Skipping.\n`);
        continue;
      }

      console.log(`🎯  Claiming winnings/refunds for round ${roundId}...`);

      // 3. Estimate gas using gasPrice: 0n to bypass balance check
      let gasEstimate: bigint;
      try {
        gasEstimate = await client.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "claimWinnings",
          args: [roundId],
          account,
          gasPrice: 0n,
        });
      } catch (err: any) {
        console.error(`    ❌  Gas estimation failed: ${err.message}\n`);
        continue;
      }

      const gasPrice = await client.getGasPrice();
      const gasEstimateWithOverhead = (gasEstimate * 101n) / 100n; // 1% overhead
      const gasCost = gasEstimateWithOverhead * gasPrice;
      console.log(`    ⛽  Gas estimate: ${gasEstimate} units (+5% overhead)  ≈ ${formatEther(gasCost)} CELO`);
      console.log(`Using round ---> ${roundId}`);
      
      // 4. Top-up if needed
      const funded = await topUpIfNeeded(account.address as `0x${string}`, gasCost);
      if (!funded) {
        console.log(`    ❌  Cannot fund account for gas cost. Skipping.\n`);
        continue;
      }

      // 5. Broadcast claimWinnings
      const txHash = await client.writeContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "claimWinnings",
        args: [roundId],
        gas: gasEstimateWithOverhead,
        // gasPrice,
      });

      console.log(`    📡  Sent! tx: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

      // 6. Update last_run
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

  console.log("✅  claim-winning-round run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
