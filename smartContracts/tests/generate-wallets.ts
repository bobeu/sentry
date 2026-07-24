/**
* Script 1: generate-wallets.ts
* 
* Generates `count` EVM-compatible wallets, funds each with a random amount
* of CELO (between 0.001 and 0.6), and appends them to accounts.json.
* 
* Usage: bun run tester:generate --count 5
*/

import { createWalletClient, http, publicActions, parseEther, formatEther } from "viem";
import { celo } from "viem/chains";
import fs from "fs";
import path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const FUNDER_PRIVATE_KEY = process.env.KEY_ROUTE as `0x${string}`;
const ACCOUNTS_FILE = path.resolve(__dirname, "accounts.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read existing accounts from storage; initialise file if absent */
function readAccounts(): Array<{
  address: string;
  private_key: string;
  date_created: string;
  last_run: string | null;
}> {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Append new accounts without overwriting existing ones */
function appendAccounts(
  existing: ReturnType<typeof readAccounts>,
  newOnes: ReturnType<typeof readAccounts>
) {
  const merged = [...existing, ...newOnes];
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`[storage] Saved ${merged.length} accounts total to ${ACCOUNTS_FILE}`);
}

/** Random CELO amount between 0.001 and 0.6 */
function randomCeloAmount(): bigint {
  const min = 0.001;
  const max = 0.6;
  const rand = Math.random() * (max - min) + min;
  // Round to 6 decimal places to avoid floating-point weirdness
  const rounded = Math.round(rand * 1_000_000) / 1_000_000;
  return parseEther(rounded.toString());
}

/** Parse --count N from argv */
function parseCount(): number {
  const idx = process.argv.indexOf("--count");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("❌  Usage: bun run generate --count <N>");
    process.exit(1);
  }
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n <= 0) {
    console.error("❌  --count must be a positive integer");
    process.exit(1);
  }
  return n;
}

/** Parse --fund <boolean> from argv. Defaults to true. */
function parseFund(): boolean {
  const idx = process.argv.indexOf("--fund");
  if (idx === -1) return true;
  const val = process.argv[idx + 1];
  return val === "true";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!FUNDER_PRIVATE_KEY) {
    console.error("❌  FUNDER_PRIVATE_KEY is not set in .env");
    process.exit(1);
  }

  const count = parseCount();
  const fund = parseFund();
  console.log(`\n🔑  Generating ${count} wallet(s) (funding=${fund})...\n`);

  // Set up funder client (wallet + public actions)
  const funderAccount = privateKeyToAccount(FUNDER_PRIVATE_KEY);
  const client = createWalletClient({
    account: funderAccount,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  // Check funder balance upfront
  const funderBalance = await client.getBalance({ address: funderAccount.address });
  console.log(`💰  Funder: ${funderAccount.address}`);
  console.log(`💰  Funder balance: ${formatEther(funderBalance)} CELO\n`);

  const existing = readAccounts();
  const newAccounts: ReturnType<typeof readAccounts> = [];

  for (let i = 0; i < count; i++) {
    // 1. Generate wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const amountToSend = randomCeloAmount();

    console.log(`─── Wallet ${i + 1}/${count} ──────────────────────────`);
    console.log(`    Address   : ${account.address}`);
    console.log(`    Amount    : ${formatEther(amountToSend)} CELO`);

    // 2. Pre-flight balance check
    if (!fund) {
      console.log(`    ℹ️  Funding skipped (--fund is not true).`);
    } else {
      const latestFunderBalance = await client.getBalance({ address: funderAccount.address });
      if (latestFunderBalance < amountToSend) {
        console.warn(`    ⚠️  Funder has insufficient balance (${formatEther(latestFunderBalance)} CELO). Skipping transfer.`);
      } else {
        // 3. Estimate gas
        try {
          const gasEstimate = await client.estimateGas({
            account: funderAccount,
            to: account.address,
            value: amountToSend,
          });
          const gasPrice = await client.getGasPrice();
          const gasCost = gasEstimate * gasPrice;

          if (latestFunderBalance < amountToSend + gasCost) {
            console.warn(`    ⚠️  Funder balance too low to cover amount + gas. Skipping transfer.`);
          } else {
            // 4. Send CELO
            const txHash = await client.sendTransaction({
              to: account.address,
              value: amountToSend,
            });
            console.log(`    ✅  Sent! tx: ${txHash}`);

            // 5. Wait for receipt
            const receipt = await client.waitForTransactionReceipt({ hash: txHash });
            console.log(`    📦  Confirmed in block ${receipt.blockNumber}`);
          }
        } catch (err: any) {
          console.error(`    ❌  Transfer failed: ${err.message}`);
          // Failure does NOT stop the loop
        }
      }
    }

    // 6. Record account
    newAccounts.push({
      address: account.address,
      private_key: privateKey,
      date_created: new Date().toISOString(),
      last_run: null,
    });

    console.log();
  }

  // 7. Persist to storage (append, never overwrite)
  appendAccounts(existing, newAccounts);
  console.log(`\n✅  Done. Generated ${count} wallet(s).`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
