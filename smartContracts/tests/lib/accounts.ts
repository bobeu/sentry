import { readFileSync } from "fs";
import { resolve } from "path";
import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { normalizePrivateKey } from "./keys";

export type VolumeAccount = {
  address: Address;
  private_key: Hex;
  account: PrivateKeyAccount;
};

/**
 * Load accounts.json without logging keys.
 * Shape: Array<{ address: string; private_key: string }>
 *
 * Each entry is an employer / user identity (userKey). Privileged owner+operator
 * txs are signed by NEW_OWNER — never by these keys.
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
    if (!isAddress(row.address)) continue;
    let pk: Hex;
    try {
      pk = normalizePrivateKey(row.private_key, `accounts.json[${row.address}]`);
    } catch (err) {
      console.warn(
        `[accounts] skipping ${row.address}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }
    const account = privateKeyToAccount(pk);
    if (account.address.toLowerCase() !== row.address.toLowerCase()) {
      console.warn(
        `[accounts] address mismatch for ${row.address} — using derived ${account.address}`,
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

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Randomly select up to `count` accounts (without replacement). */
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
  count: number;
  txcount: number;
  /** Delay between txs, in seconds. */
  wait: number;
  currency: "CELO" | "USDm" | "USDC" | "USDT";
  accountsFile: string;
  /** Fixed amount when --min/--max not set. */
  amount: number;
  min?: number;
  max?: number;
  /** When true, fund after register / create (see ensure* scripts). */
  fund: boolean;
  /** Optional dedicated fund range (falls back to --min/--max). */
  fundMin?: number;
  fundMax?: number;
  loop: number;
  identity?: string;
  destination?: string;
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

/** Resolve action amount: prefer --min/--max, else --amount. */
export function resolveAmount(args: CliArgs): number {
  if (args.min !== undefined || args.max !== undefined) {
    const min = args.min ?? args.max ?? args.amount;
    const max = args.max ?? args.min ?? args.amount;
    return randomInRange(min, max);
  }
  return args.amount;
}

/**
 * Resolve fund amount.
 * Prefer --fund-min/--fund-max, else --min/--max, else --amount when --fund is set.
 */
export function resolveFundAmount(args: CliArgs): number | undefined {
  if (args.fundMin !== undefined || args.fundMax !== undefined) {
    const min = args.fundMin ?? args.fundMax ?? 0;
    const max = args.fundMax ?? args.fundMin ?? 0;
    return randomInRange(min, max);
  }
  if (args.min !== undefined || args.max !== undefined) {
    const min = args.min ?? args.max ?? 0;
    const max = args.max ?? args.min ?? 0;
    return randomInRange(min, max);
  }
  if (args.fund) return args.amount;
  return undefined;
}

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const out: CliArgs = {
    count: 1,
    txcount: 1,
    wait: 1.5,
    currency: "CELO",
    accountsFile: resolve(process.cwd(), "tests", "accounts.json"),
    amount: 0.001,
    fund: false,
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
    } else if ((a === "--currency" || a === "--token" || a === "--cur") && next) {
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
    } else if (a === "--fund") {
      // boolean flag; optional value true|false|1|0
      if (next && !next.startsWith("-")) {
        out.fund = next === "true" || next === "1" || next === "yes";
        i++;
      } else {
        out.fund = true;
      }
    } else if ((a === "--fund-min" || a === "--fundmin") && next) {
      out.fundMin = parseNonNegNumber(next);
      out.fund = true;
      i++;
    } else if ((a === "--fund-max" || a === "--fundmax") && next) {
      out.fundMax = parseNonNegNumber(next);
      out.fund = true;
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
    }
  }
  return out;
}
