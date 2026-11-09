import "dotenv/config";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

// Load .env.local if present
const envLocal = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, override: true });
}

// Attribution tag registered for Agents on Open Rails hackathon
const ATTRIBUTION_TAG = "celo_39f96dcb58cc";
const ATTRIBUTION_SUFFIX =
  "0x63656c6f5f333966393664636235386363110080218021802180218021802180218021" as const;

async function main() {
  const privateKey = (
    process.env.AGENT_KEY ||
    process.env.AGENT_PRIVATE_KEY ||
    process.env.SENTRY_OPERATOR_KEY
  )?.trim();

  if (!privateKey) {
    console.error("\n❌ Error: Missing AGENT_KEY in environment variables.");
    console.error("Please add AGENT_KEY=0x... to your .env or .env.local file, or run inline:");
    console.error("  AGENT_KEY=0x... npm --prefix ui run send:tagged");
    process.exit(1);
  }

  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;

  const account = privateKeyToAccount(formattedKey);
  console.log("============================================================");
  console.log("🚀 Sentry Hackathon Tagged Transaction (Celo Mainnet)");
  console.log("============================================================");
  console.log(`Agent Wallet Address: ${account.address}`);
  console.log(`Attribution Tag:      ${ATTRIBUTION_TAG}`);
  console.log(`ERC-8021 Data Suffix: ${ATTRIBUTION_SUFFIX}`);

  const rpcUrl = process.env.CELO_RPC || "https://forno.celo.org";
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Current Balance:      ${formatEther(balance)} CELO`);

  if (balance === 0n) {
    console.error("\n❌ Insufficient CELO balance to cover gas fees.");
    console.error("Please fund your agent wallet with a small amount of CELO (e.g. 0.05 CELO).");
    process.exit(1);
  }

  console.log("\nSending tagged self-transfer transaction on Celo Mainnet...");

  const hash = await walletClient.sendTransaction({
    to: account.address,
    value: 0n,
    data: ATTRIBUTION_SUFFIX,
  });

  console.log(`\n✅ Transaction Broadcast! Hash: ${hash}`);
  console.log(`Waiting for block confirmation on Celo Mainnet...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n🎉 Confirmed in block #${receipt.blockNumber}! Status: ${receipt.status}`);
  console.log(`\n🔗 Celoscan URL: https://celoscan.io/tx/${hash}`);
  console.log("============================================================");
  console.log("Next steps on Loops House:");
  console.log("1. Open: https://www.loops.house/agents-on-open-rails/playground/submit");
  console.log("2. In the Celo Checklist, click 'Find it' (or paste the transaction hash above).");
  console.log("3. Ensure all checkmarks are green!");
  console.log("============================================================");
}

main().catch((err) => {
  console.error("\n❌ Transaction execution failed:", err.message || err);
  process.exit(1);
});
