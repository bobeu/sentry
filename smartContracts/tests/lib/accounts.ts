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

/** Random float in [min, max] (inclusive). */
export function randomInRange(min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  if (min === max) return min;
  return min + Math.random() * (max - min);
}

export type CliArgs = {
  /** CLI subcommand (e.g. transfer, charge). */
  command: string;
  /** How many accounts to randomly select from accounts.json. */
  count: number;
  /** How many times to run the command tx for each selected account. */
  txcount: number;
  /**
   * Delay between txs, in seconds (converted to ms at runtime).
   * Example: `--wait 5` → 5 seconds.
   */
  wait: number;
  currency: "CELO" | "USDm" | "USDC" | "USDT";
  accountsFile: string;
  /** Fixed amount when --min/--max not set. */
  amount: number;
  /** Optional random amount range for charge/payout/transfer. */
  min?: number;
  max?: number;
  /** Optional random CELO/token fund range into employment/reward wallets. */
  fundmin?: number;
  fundmax?: number;
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

function parseNonNegNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Resolve amount: prefer --min/--max random range, else --amount. */
export function resolveAmount(args: CliArgs): number {
  if (args.min !== undefined && args.max !== undefined) {
    return randomInRange(args.min, args.max);
  }
  if (args.min !== undefined) return args.min;
  if (args.max !== undefined) return args.max;
  return args.amount;
}

/** Resolve fund amount when fundmin/fundmax set; undefined if not funding. */
export function resolveFundAmount(args: CliArgs): number | undefined {
  if (args.fundmin === undefined && args.fundmax === undefined) return undefined;
  const min = args.fundmin ?? args.fundmax ?? 0;
  const max = args.fundmax ?? args.fundmin ?? 0;
  return randomInRange(min, max);
}

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const out: CliArgs = {
    command: args[0] && !args[0].startsWith("-") ? args[0] : "help",
    count: 1,
    txcount: 1,
    wait: 1.5,
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
      // Seconds (user-facing). `--wait 5` → 5s between txs.
      out.wait = Math.max(0, Number(next) || 0);
      i++;
    } else if (
      (a === "--currency" || a === "--token" || a === "--cur") &&
      next
    ) {
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
    } else if (a === "--min" && next) {
      out.min = parseNonNegNumber(next);
      i++;
    } else if (a === "--max" && next) {
      out.max = parseNonNegNumber(next);
      i++;
    } else if (a === "--fundmin" && next) {
      out.fundmin = parseNonNegNumber(next);
      i++;
    } else if (a === "--fundmax" && next) {
      out.fundmax = parseNonNegNumber(next);
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
