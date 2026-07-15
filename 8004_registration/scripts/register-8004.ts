/**
 * Register Sentry as an ERC-8004 agent on Celo mainnet.
 *
 * Usage:
 *   1. Copy values into `.env` (PRIVATE_KEY required)
 *   2. bun run gen:8004
 *
 * Optional:
 *   AGENT_URI=https://...   Use a hosted registration JSON instead of data: URI
 *   DRY_RUN=true            Print metadata + encoded tx, do not broadcast
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  toEventHash,
  type Hex,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { Attribution } from "ox/erc8021";
import { identityRegistryAbi } from "./abi/identity-registry";

const IDENTITY_REGISTRY =
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const CELO_RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const ATTRIBUTION_TAG = process.env.ATTRIBUTION_TAG ?? "celo_e3cc4c8d8a0e";
const AGENT_WALLET =
  (process.env.AGENT_WALLET_ADDRESS ??
    "0xa1f70ffA4322E3609dD905b41f17Bf3913366bC1") as `0x${string}`;

const REGISTERED_TOPIC = toEventHash(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
);
const TRANSFER_TOPIC = toEventHash(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const ROOT = resolve(import.meta.dir, "..");
const REGISTRATION_PATH = resolve(ROOT, "agent/registration.json");
const OUT_DIR = resolve(ROOT, "agent/out");

type WalletEndpoint = {
  type: "wallet";
  address: `0x${string}`;
  chainId: number;
};

type AgentRegistration = {
  type?: string;
  name: string;
  description?: string;
  image?: string;
  services?: unknown[];
  endpoints: Array<WalletEndpoint | Record<string, unknown>>;
  x402Support: boolean;
  active: boolean;
  supportedTrust?: string[];
  registrations?: Array<{
    agentId: number;
    agentRegistry: string;
  }>;
  [key: string]: unknown;
};

function requirePrivateKey(): Hex {
  const raw = process.env.PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Missing PRIVATE_KEY in .env — add the Celo mainnet key that will mint the agent NFT.",
    );
  }
  if (!raw.startsWith("0x")) {
    return `0x${raw}` as Hex;
  }
  return raw as Hex;
}

function loadRegistration(): AgentRegistration {
  const json = JSON.parse(readFileSync(REGISTRATION_PATH, "utf8")) as Record<
    string,
    unknown
  >;

  const endpoints: AgentRegistration["endpoints"] = Array.isArray(
    json.endpoints,
  )
    ? [...(json.endpoints as AgentRegistration["endpoints"])]
    : [];
  const walletIdx = endpoints.findIndex(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "type" in e &&
      (e as { type: string }).type === "wallet",
  );
  const walletEndpoint: WalletEndpoint = {
    type: "wallet",
    address: AGENT_WALLET,
    chainId: 42220,
  };
  if (walletIdx >= 0) endpoints[walletIdx] = walletEndpoint;
  else endpoints.push(walletEndpoint);

  return {
    ...json,
    name: typeof json.name === "string" ? json.name : "Sentry",
    endpoints,
    x402Support: true,
    active: true,
  };
}

function toAgentUri(registration: AgentRegistration): string {
  if (process.env.AGENT_URI?.trim()) {
    return process.env.AGENT_URI.trim();
  }
  const encoded = Buffer.from(JSON.stringify(registration), "utf8").toString(
    "base64",
  );
  return `data:application/json;base64,${encoded}`;
}

function extractAgentId(logs: readonly Log[]): bigint | undefined {
  for (const log of logs) {
    const [topic0, topic1, , topic3] = log.topics;
    if (topic0 === REGISTERED_TOPIC && topic1) {
      return BigInt(topic1);
    }
    if (topic0 === TRANSFER_TOPIC && topic3) {
      return BigInt(topic3);
    }
  }
  return undefined;
}

function stringToBytes(value: string): Hex {
  return `0x${Buffer.from(value, "utf8").toString("hex")}` as Hex;
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const privateKey = requirePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const registration = loadRegistration();
  const agentURI = toAgentUri(registration);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUT_DIR, "registration.prepared.json"),
    JSON.stringify(registration, null, 2),
  );

  console.log("Sentry ERC-8004 registration");
  console.log("----------------------------");
  console.log(`Signer:           ${account.address}`);
  console.log(`Agent wallet:     ${AGENT_WALLET}`);
  console.log(`Identity registry:${IDENTITY_REGISTRY}`);
  console.log(`Attribution tag:  ${ATTRIBUTION_TAG}`);
  console.log(
    `Agent URI mode:   ${process.env.AGENT_URI ? "hosted AGENT_URI" : "data: URI (embedded)"}`,
  );
  console.log(`Dry run:          ${dryRun}`);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(CELO_RPC),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Signer balance:   ${balance} wei`);
  if (balance === 0n) {
    throw new Error(
      `Signer ${account.address} has 0 CELO on mainnet. Fund it with a little gas, then retry.`,
    );
  }

  const metadata = [
    { metadataKey: "project", metadataValue: stringToBytes("Sentry") },
    { metadataKey: "category", metadataValue: stringToBytes("telegram-ai-employee") },
    { metadataKey: "hackathon", metadataValue: stringToBytes("agentic-payments-defai") },
    { metadataKey: "attribution", metadataValue: stringToBytes(ATTRIBUTION_TAG) },
  ] as const;

  const callData = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentURI, [...metadata]],
  });

  // Append ERC-8021 attribution suffix so DeFAI leaderboard can credit volume.
  const suffix = Attribution.toDataSuffix({ codes: [ATTRIBUTION_TAG] });
  const data = `${callData}${suffix.replace(/^0x/, "")}` as Hex;

  if (dryRun) {
    console.log("\nDRY_RUN — not broadcasting.");
    console.log(`Prepared URI length: ${agentURI.length}`);
    console.log(`Calldata bytes: ${data.length / 2 - 1}`);
    console.log(`Wrote ${resolve(OUT_DIR, "registration.prepared.json")}`);
    return;
  }

  console.log("\nBroadcasting register() on Celo mainnet...");
  const hash = await walletClient.sendTransaction({
    to: IDENTITY_REGISTRY,
    data,
    account,
    chain: celo,
  });
  console.log(`Tx hash: ${hash}`);
  console.log(`Explorer: https://celoscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Registration tx reverted: ${hash}`);
  }

  const agentId = extractAgentId(receipt.logs);

  if (agentId === undefined) {
    throw new Error("Could not parse agentId from receipt logs.");
  }

  const scanUrl = `https://8004scan.io/agents/celo/${agentId.toString()}`;
  const celoscanNft = `https://celoscan.io/nft/${IDENTITY_REGISTRY}/${agentId.toString()}`;

  const result = {
    agentId: agentId.toString(),
    txHash: hash,
    owner: account.address,
    agentWallet: AGENT_WALLET,
    attributionTag: ATTRIBUTION_TAG,
    agentURIMode: process.env.AGENT_URI ? "hosted" : "data",
    urls: {
      "8004scan": scanUrl,
      celoscanNft,
      tx: `https://celoscan.io/tx/${hash}`,
    },
  };

  writeFileSync(resolve(OUT_DIR, "registration-result.json"), JSON.stringify(result, null, 2));

  // Keep local registration.json in sync with the minted id (for later setAgentURI updates).
  const updated = {
    ...registration,
    registrations: [
      {
        agentId: Number(agentId),
        agentRegistry: `eip155:42220:${IDENTITY_REGISTRY}`,
      },
    ],
  };
  writeFileSync(REGISTRATION_PATH, JSON.stringify(updated, null, 2) + "\n");

  console.log("\nRegistered successfully.");
  console.log(`Agent ID:     ${agentId}`);
  console.log(`8004scan:     ${scanUrl}`);
  console.log(`Celoscan NFT: ${celoscanNft}`);
  console.log(`Saved:        agent/out/registration-result.json`);
  console.log(
    "\nNext: send me the 8004scan URL and I will attach it to your DeFAI submission draft.",
  );
}

main().catch((err) => {
  console.error("\nRegistration failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
