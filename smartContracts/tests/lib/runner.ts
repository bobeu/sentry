import "dotenv/config";
import { BlockchainService } from "../blockchain.service";
import {
  loadAccounts,
  parseArgs,
  selectAccounts,
  sleep,
  type CliArgs,
  type VolumeAccount,
} from "./accounts";
import { CELO_ATTRIBUTION_TAG } from "./attribution";
import type { PaymentCurrency } from "./payment-currency";

export type RunStats = { ok: number; failed: number };

export type AccountWork = (
  svc: BlockchainService,
  employer: VolumeAccount,
  accountIndex: number,
  txIndex: number,
  args: CliArgs,
) => Promise<void>;

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Shared CLI bootstrap for ensure* scripts.
 * accounts.json entries are employers/users; NEW_OWNER signs owner+operator txs.
 */
export async function runEnsureScript(input: {
  name: string;
  helpText: string;
  work: AccountWork;
}): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(input.helpText);
    return;
  }

  process.env.CELO_RPC = process.env.CELO_RPC ?? "https://forno.celo.org";
  console.log(`Network: Celo mainnet · RPC=${process.env.CELO_RPC}`);
  console.log(`Attribution: ${CELO_ATTRIBUTION_TAG}`);
  console.log(
    `Script=${input.name} count=${args.count} txcount=${args.txcount} wait=${args.wait}s currency=${args.currency} amount=${args.amount} min=${args.min ?? "-"} max=${args.max ?? "-"} fund=${args.fund} fundMin=${args.fundMin ?? "-"} fundMax=${args.fundMax ?? "-"} loop=${args.loop}`,
  );

  if (!(process.env.NEW_OWNER || "").trim()) {
    throw new Error("NEW_OWNER is required (owner + operator signer)");
  }
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.warn(
      "⚠️  FUNDER_KEY is not set — funding + gas top-ups will fail when balances are low.",
    );
  }

  const all = loadAccounts(args.accountsFile);
  if (!all.length) {
    throw new Error(
      `No accounts loaded from ${args.accountsFile}. Populate with [{ "address", "private_key" }, ...]`,
    );
  }

  const currency = args.currency as PaymentCurrency;
  void currency;
  const delay = Math.max(0, args.wait) * 1000;
  const totals: RunStats = { ok: 0, failed: 0 };

  for (let round = 0; round < args.loop; round++) {
    const selected = selectAccounts(all, args.count);
    if (args.loop > 1) console.log(`\n=== loop ${round + 1}/${args.loop} ===`);
    console.log(
      `Selected ${selected.length} employer(s) (requested --count ${args.count}):`,
    );
    for (const a of selected) console.log(`  · ${a.address}`);

    const reps = Math.max(1, args.txcount);
    for (let i = 0; i < selected.length; i++) {
      const employer = selected[i]!;
      // Privileged txs use NEW_OWNER; employer identity is only the userKey.
      const svc = new BlockchainService();
      for (let t = 0; t < reps; t++) {
        try {
          console.log(
            `[employer ${i + 1}/${selected.length} tx ${t + 1}/${reps}] ${employer.address}`,
          );
          await input.work(svc, employer, i, t, args);
          totals.ok += 1;
        } catch (err) {
          totals.failed += 1;
          console.error(
            `  FAILED [employer ${i + 1}/${selected.length} tx ${t + 1}/${reps}] ${employer.address}: ${formatErr(err)}`,
          );
        }
        const isLast =
          round === args.loop - 1 && i === selected.length - 1 && t === reps - 1;
        if (delay > 0 && !isLast) await sleep(delay);
      }
    }
  }

  console.log(`\nDone. ok=${totals.ok} failed=${totals.failed}`);
  if (totals.failed > 0) process.exitCode = 1;
}
