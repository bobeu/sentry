/**
 * Script 5: fund-accounts.ts
 *
 * Picks `count` random accounts from accounts.json and sends `amount` CELO
 * from the FUNDER wallet to each one.
 *
 * Usage: bun run tester:fundaccount --count 3 --amount 0.05
 */

import { createWalletClient, http, publicActions, parseEther, formatEther } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import {
  readAccounts,
  pickRandom,
  parseCount,
  RPC_URL,
} from "./utils";

// Helper to parse --amount
function parseAmount(): string {
  const idx = process.argv.indexOf("--amount");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("❌  Usage: bun run tester:fundaccount --count <N> --amount <CELO_amount>");
    process.exit(1);
  }
  const amt = process.argv[idx + 1];
  if (isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
    console.error("❌  --amount must be a positive number");
    process.exit(1);
  }
  return amt;
}

async function main() {
  const FUNDER_KEY = (process.env.FUNDER_KEY || "").trim() as `0x${string}`;
  if (!FUNDER_KEY) {
    console.error("❌  FUNDER_KEY not set in .env");
    process.exit(1);
  }

  const funderAccount = privateKeyToAccount(
    (FUNDER_KEY.startsWith("0x") ? FUNDER_KEY : `0x${FUNDER_KEY}`) as `0x${string}`,
  );
  const client = createWalletClient({
    account: funderAccount,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  const count = parseCount();
  const amountStr = parseAmount();
  const amount = parseEther(amountStr);

  const allAccounts = readAccounts();
  if (allAccounts.length === 0) {
    console.error("❌  No accounts in storage. Run tester:generate first.");
    process.exit(1);
  }

  const selected = pickRandom(allAccounts, count);
  console.log(`\n💸  fund-accounts — sending ${formatEther(amount)} CELO to ${selected.length} random account(s) from funder ${funderAccount.address}\n`);

  // Check funder balance upfront
  const funderBalance = await client.getBalance({ address: funderAccount.address });
  const totalNeeded = amount * BigInt(selected.length);
  if (funderBalance < totalNeeded) {
    console.error(`❌  Funder balance is insufficient. Has ${formatEther(funderBalance)} CELO, needs at least ${formatEther(totalNeeded)} CELO. Exiting.`);
    process.exit(1);
  }

  for (let i = 0; i < selected.length; i++) {
    const target = selected[i];
    console.log(`─── Account ${i + 1}/${selected.length}: ${target.address} ────────────────────`);

    try {
      // Estimate gas first to make sure it works and get legacy gasPrice
      const gasEstimate = await client.estimateGas({
        account: funderAccount,
        to: target.address as `0x${string}`,
        value: amount,
      });
      const gasPrice = await client.getGasPrice();
      const gasCost = gasEstimate * gasPrice;

      // Double check if funder still has enough
      const currentFunderBalance = await client.getBalance({ address: funderAccount.address });
      if (currentFunderBalance < amount + gasCost) {
        console.warn(`    ⚠️  Funder balance too low for this transaction. Skipping.`);
        continue;
      }

      // Send the transaction using legacy format by explicitly passing gasPrice
      const txHash = await client.sendTransaction({
        to: target.address as `0x${string}`,
        value: amount,
        gasPrice,
      });

      console.log(`    📡  Sent! tx: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`    ✅  Confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);
    } catch (err: any) {
      console.error(`    ❌  Transfer failed: ${err.message}`);
    }

    console.log();
  }

  console.log("✅  Funding run complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
