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
  parseWait,
  sleep,
  topUpIfNeeded,
  RPC_URL,
  VIBEPLAY_ABI,
  VIBEPLAY_ADDRESS,
} from "./utils";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.error("❌  FUNDER_KEY not set in .env (used by topUpIfNeeded for gas)");
    process.exit(1);
  }

  const waitSecs = parseWait();
  const allAccounts = readAccounts();

  if (allAccounts.length === 0) {
    console.error("❌  No accounts in storage. Run tester:generate first.");
    process.exit(1);
  }

  // Extract the last 10 accounts from accounts.json
  const selected = allAccounts.slice(-10);
  console.log(`\n🏆  claimWinningsLast10 — using last ${selected.length} account(s) from accounts.json\n`);

  for (const storedAcc of selected) {
    console.log(`─── Account: ${storedAcc.address} ────────────────────`);

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
      }) as any;

      const rounds: any[] = data.rounds || [];
      const userPredictions: any[] = data.userPredictions || [];

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

        targetRoundId = round.id;
        break;
      }

      if (targetRoundId === null) {
        console.log(`    ⚠️  No claimable rounds found for this account. Skipping.\n`);
        continue;
      }

      console.log(`    🎯  Claiming winnings for round ${targetRoundId}...`);

      // ── 2. Estimate gas using gasPrice: 0n to bypass balance check ─────────
      let gasEstimate: bigint;
      try {
        gasEstimate = await client.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "claimWinnings",
          args: [targetRoundId],
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
        args: [targetRoundId],
        gas: gasEstimateWithOverhead,
        gasPrice,
      });

      console.log(`    📡  Sent! tx: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

      // ── 5. Update last_run ─────────────────────────────────────────────────
      touchLastRun(allAccounts, storedAcc.address);

      if (waitSecs > 0) {
        console.log(`    ⏳  Waiting ${waitSecs} seconds before the next account...`);
        await sleep(waitSecs);
      }
    } catch (err: any) {
      console.error(`    ❌  Unexpected error: ${err.message}`);
    }

    console.log();
  }

  console.log("✅  claim-winning-last-10 run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
