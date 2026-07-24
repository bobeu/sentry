import {
  createWalletClient,
  http,
  publicActions,
  parseEther,
  formatEther,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import crypto from "crypto";
import "dotenv/config";
import {
  readAccounts,
  RPC_URL,
  VIBEPLAY_ADDRESS,
  VIBEPLAY_ABI,
  ACCOUNTS_FILE,
  parseWait,
  sleep,
} from "./utils";

// Parse --count N from argv
function parseCount(): number {
  const idx = process.argv.indexOf("--count");
  if (idx === -1 || !process.argv[idx + 1]) {
    return 1; // default to 1 if not provided
  }
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n <= 0) {
    console.error("❌  --count must be a positive integer");
    process.exit(1);
  }
  return n;
}

async function main() {
  const FUNDER_KEY = process.env.KEY_ROUTE as `0x${string}`;
  if (!FUNDER_KEY) {
    console.error("❌  KEY_ROUTE (funder key) not set in .env");
    process.exit(1);
  }

  const count = parseCount();
  // const waitSecs = parseWait();
  const waitSecs: number | undefined = undefined; // Comment out this line if you uncomment the parseWait line above
  console.log(`\n🚀  Starting generate-and-predict script for ${count} new account(s)...`);

  const funderAccount = privateKeyToAccount(FUNDER_KEY);
  const funderClient = createWalletClient({
    account: funderAccount,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);

  // Check funder balance upfront
  const funderBalance = await funderClient.getBalance({ address: funderAccount.address });
  console.log(`💰  Funder address: ${funderAccount.address}`);
  console.log(`💰  Funder balance: ${formatEther(funderBalance)} CELO\n`);

  const existingAccounts = readAccounts();
  const newlyCreatedAccounts: typeof existingAccounts = [];

  for (let i = 0; i < count; i++) {
    console.log(`─── Account ${i + 1}/${count} ──────────────────────────`);

    // 1. Generate wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    console.log(`    Generated Address: ${account.address}`);

    // Create client for this new account
    const userClient = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    }).extend(publicActions);

    try {
      // 2. Fetch contract data to ensure current round is active and stage is PLACEPREDICTION
      const data = await funderClient.readContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "getData",
        args: [account.address as Address],
      }) as any;

      const currentRound = data.currentRound;
      if (currentRound.isSettled) {
        console.log(`    ⚠️  Current round is already settled. Skipping predictions.\n`);
        continue;
      }
      if (currentRound.stage !== 0) {
        console.log(`    ⚠️  Round not in PLACEPREDICTION stage (stage=${currentRound.stage}). Skipping.\n`);
        continue;
      }

      // Generate random predict amount & direction
      const randomBuf = crypto.randomBytes(5);
      const randomFloat = randomBuf.readUInt32LE(0) / 4294967295;
      const amountEth = Math.round((randomFloat * (0.05 - 0.001) + 0.001) * 1_000_000) / 1_000_000;
      const amount = parseEther(amountEth.toString());
      const predictsHigher = randomBuf[4] >= 128;

      console.log(`    🎲  predictsHigher=${predictsHigher}  amount=${formatEther(amount)} CELO`);

      // 3. Estimate gas for placePrediction using funder as caller
      let gasEstimate: bigint;
      try {
        gasEstimate = await funderClient.estimateContractGas({
          address: VIBEPLAY_ADDRESS,
          abi: VIBEPLAY_ABI,
          functionName: "placePrediction",
          args: [predictsHigher, amount],
          value: amount,
          account: funderAccount,
        });
      } catch (err: any) {
        console.error(`    ❌  Gas estimation failed: ${err.message}\n`);
        continue;
      }

      const gasPrice = await funderClient.getGasPrice();
      const gasEstimateWithOverhead = (gasEstimate * 101n) / 100n;
      const gasCost = gasEstimateWithOverhead * gasPrice;
      const totalRequired = amount + gasCost;

      console.log(`    ⛽  Gas cost estimate: ${formatEther(gasCost)} CELO (total required: ${formatEther(totalRequired)} CELO)`);

      // 4. Fund the new account from Funder
      const latestFunderBalance = await funderClient.getBalance({ address: funderAccount.address });
      if (latestFunderBalance < totalRequired) {
        console.warn(`    ⚠️  Funder balance is insufficient (${formatEther(latestFunderBalance)} CELO). Skipping funding.`);
        continue;
      }

      console.log(`    💸  Funding new wallet from funder...`);
      const fundTxHash = await funderClient.sendTransaction({
        to: account.address,
        value: totalRequired,
      });
      console.log(`    📡  Funding transaction sent: ${fundTxHash}`);
      await funderClient.waitForTransactionReceipt({ hash: fundTxHash });
      console.log(`    ✅  Funding confirmed!`);

      // Verify the new balance
      const newBalance = await userClient.getBalance({ address: account.address });
      console.log(`    💰  Wallet funded balance: ${formatEther(newBalance)} CELO`);

      // 5. Place Prediction from the new account
      console.log(`    ✍️  Sending placePrediction from the new wallet...`);
      const predictTxHash = await userClient.writeContract({
        address: VIBEPLAY_ADDRESS,
        abi: VIBEPLAY_ABI,
        functionName: "placePrediction",
        args: [predictsHigher, amount],
        value: amount,
        gas: gasEstimateWithOverhead,
        gasPrice,
      });
      console.log(`    📡  Prediction transaction sent: ${predictTxHash}`);
      const receipt = await userClient.waitForTransactionReceipt({ hash: predictTxHash });
      console.log(`    ✅  Prediction confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);

      // 6. Record newly created account with success details
      newlyCreatedAccounts.push({
        address: account.address,
        private_key: privateKey,
        date_created: new Date().toISOString(),
        last_run: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`    ❌  Transaction flow failed: ${err.message}`);
      // Even if predicting failed, we record the generated account in case it was funded
      newlyCreatedAccounts.push({
        address: account.address,
        private_key: privateKey,
        date_created: new Date().toISOString(),
        last_run: null,
      });
    }

    const delay = waitSecs !== undefined ? waitSecs : Math.floor(Math.random() * 20) + 1;
    if (delay > 0) {
      console.log(`    ⏳  Waiting ${delay} seconds before the next account...`);
      await sleep(delay);
    }

    console.log();
  }

  // 7. Persist generated wallets to accounts.json
  if (newlyCreatedAccounts.length > 0) {
    const mergedAccounts = [...existingAccounts, ...newlyCreatedAccounts];
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(mergedAccounts, null, 2), "utf-8");
    console.log(`[storage] Appended ${newlyCreatedAccounts.length} new account(s) to ${ACCOUNTS_FILE}`);
  }

  console.log("🏁  generate-and-predict process finished.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
