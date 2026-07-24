import { readFileSync } from "fs";
import { resolve } from "path";
import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export type VolumeAccount = {
  address: Address;
  private_key: Hex;
  account: PrivateKeyAccount;
};

/**
 * Load accounts.json without logging keys.
 * Shape: Array<{ address: string; private_key: string }>
 */
export function loadAccounts(filePath?: string): VolumeAccount[] {
  const path = resolve(
    filePath ?? resolve(process.cwd(), "tests", "accounts.json"),
  );
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Array<{
    address?: string;
    private_key?: string;
  }>;
  if (!Array.isArray(parsed)) {
    throw new Error("accounts.json must be an array of { address, private_key }");
  }

  const out: VolumeAccount[] = [];
  for (const row of parsed) {
    if (!row?.address || !row?.private_key) continue;
    const pk = (
      row.private_key.startsWith("0x") ? row.private_key : `0x${row.private_key}`
    ) as Hex;
    const account = privateKeyToAccount(pk);
    const address = row.address as Address;
    if (!isAddress(address)) continue;
    if (account.address.toLowerCase() !== address.toLowerCase()) {
      console.warn(
        `[accounts] address mismatch for ${address} — using derived ${account.address}`,
      );
    }
    out.push({
      address: account.address,
      private_key: pk,
      account,
    });
  }
  return out;
}

/** Fisher–Yates shuffle (in place). */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/**
 * Randomly select up to `count` accounts from the pool (without replacement).
 * If count >= pool size, returns a shuffled copy of all accounts.
 */
export function selectAccounts(all: VolumeAccount[], count: number): VolumeAccount[] {
  if (count <= 0 || all.length === 0) return [];
  const pool = shuffleInPlace(all.slice());
  if (count >= pool.length) return pool;
  return pool.slice(0, count);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type CliArgs = {
  /** CLI subcommand (e.g. transfer, charge). */
  command: string;
  /** How many accounts to randomly select from accounts.json. */
  count: number;
  /** How many times to run the command tx for each selected account. */
  txcount: number;
  /** Delay in ms between individual txs. */
  wait: number;
  currency: "CELO" | "USDm" | "USDC" | "USDT";
  accountsFile: string;
  amount: number;
  /** Outer batch repeat (re-selects a random account set each round). */
  loop: number;
  identity?: string;
  destination?: string;
  enabled?: boolean;
  help: boolean;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const out: CliArgs = {
    command: args[0] && !args[0].startsWith("-") ? args[0] : "help",
    count: 1,
    txcount: 1,
    wait: 1500,
    currency: "CELO",
    accountsFile: resolve(process.cwd(), "tests", "accounts.json"),
    amount: 0.001,
    loop: 1,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const next = args[i + 1];
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--count" && next) {
      out.count = parsePositiveInt(next, 1);
      i++;
    } else if ((a === "--txcount" || a === "--tx-count") && next) {
      out.txcount = parsePositiveInt(next, 1);
      i++;
    } else if (a === "--wait" && next) {
      out.wait = Math.max(0, Number(next) || 0);
      i++;
    } else if ((a === "--currency" || a === "--token") && next) {
      const c = next.toUpperCase();
      if (c === "CELO" || c === "USDM" || c === "USDC" || c === "USDT") {
        out.currency = c === "USDM" ? "USDm" : (c as CliArgs["currency"]);
      }
      i++;
    } else if (a === "--accounts" && next) {
      out.accountsFile = resolve(next);
      i++;
    } else if (a === "--amount" && next) {
      out.amount = Number(next) || 0;
      i++;
    } else if (a === "--loop" && next) {
      out.loop = parsePositiveInt(next, 1);
      i++;
    } else if (a === "--identity" && next) {
      out.identity = next;
      i++;
    } else if (a === "--destination" && next) {
      out.destination = next;
      i++;
    } else if (a === "--enabled" && next) {
      out.enabled = next === "true" || next === "1";
      i++;
    }
  }
  return out;
}
