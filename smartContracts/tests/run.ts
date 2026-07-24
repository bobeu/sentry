/**
 * Celo mainnet volume CLI — drives every BlockchainService method using
 * private keys from accounts.json (viem, no wallet provider).
 *
 * Usage:
 *   npx tsx tests/run.ts <command> [--count N] [--txcount N] [--wait MS]
 *     [--currency CELO|USDm|USDC|USDT] [--amount N] [--loop N]
 *     [--accounts path] [--destination 0x...]
 *
 * Network: Celo mainnet (42220) only. Attribution: celo_e3cc4c8d8a0e
 */
import "dotenv/config";
import {
  keccak256,
  parseEther,
  parseUnits,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import {
  BlockchainService,
  clearVolumeSigner,
  withVolumeSigner,
} from "./blockchain.service";
import {
  loadAccounts,
  parseArgs,
  selectAccounts,
  sleep,
  type VolumeAccount,
} from "./lib/accounts";
import { CELO_ATTRIBUTION_TAG } from "./lib/attribution";
import type { PaymentCurrency } from "./lib/payment-currency";

function help() {
  console.log(`
Sentry volume scripts — Celo mainnet (attribution ${CELO_ATTRIBUTION_TAG})

Commands (map to blockchain.service.ts):
  connect                 Print chain / contract config
  balance                 getEmploymentBalance for each selected account
  sync-balance            syncBalanceCache
  wallet-token            getWalletTokenAddress
  create-wallet           ensureSentryWallet (needs factory owner key in account)
  register                registerEmploymentOnChain
  charge                  chargeSettlementOnChain
  estimate-fee            estimateChargeSettlementFeeCelo
  set-withdrawal          setWithdrawalDestination
  withdraw                withdrawOnChain
  pause                   pauseOnChain
  resume                  resumeOnChain
  notify-funding          notifyWalletFunding
  set-currency            setCurrencyEnabled (--enabled true|false)
  update-token            updateTokenAddress (--destination = token addr)
  create-reward           ensureRewardAccount
  reward-balance          rewardAccountBalance (--destination = account)
  reward-payout           payoutReward
  pause-reward            pauseRewardAccount
  resume-reward           resumeRewardAccount
  transfer                sendNativeAttributed (CELO volume with attribution)
  volume                  loop transfer across accounts for high tx count

Flags:
  --count N         randomly select N accounts from accounts.json (default 1)
  --txcount N       run the command N times per selected account (default 1)
  --wait MS         delay between txs (default 1500)
  --currency NAME   CELO | USDm | USDC | USDT (default CELO)
  --amount N        amount in token units (default 0.001)
  --loop N          outer batch repeat; re-selects random accounts each round (default 1)
  --accounts PATH   path to accounts.json
  --destination 0x  extra address (withdrawal / payout / token)
  --identity HEX    identityHash for create-wallet (default keccak of address)
  --enabled true    for set-currency

Example:
  npm run vol:transfer -- --count 5 --txcount 3 --wait 2000 --amount 0.0001

Env:
  FUNDER_KEY          private key used by topUpIfNeeded when a signer is short on CELO gas
  CELO_RPC / CELO_RPC_URL
  EMPLOYMENT_OWNER_KEY / EMPLOYMENT_OPERATOR_KEY (or VOLUME_SIGNER_KEY via accounts.json)
`);
}

type RunStats = { ok: number; failed: number };

type TxWork = (
  svc: BlockchainService,
  acct: VolumeAccount,
  accountIndex: number,
  txIndex: number,
) => Promise<void>;

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * For each selected account, run `work` exactly `txcount` times.
 * Failures are caught per tx so one bad send does not block the next.
 */
async function forEachAccount(
  accounts: VolumeAccount[],
  waitMs: number,
  txcount: number,
  work: TxWork,
): Promise<RunStats> {
  const stats: RunStats = { ok: 0, failed: 0 };
  const totalAccounts = accounts.length;
  const reps = Math.max(1, txcount);

  for (let i = 0; i < totalAccounts; i++) {
    const acct = accounts[i]!;
    withVolumeSigner(acct);
    const svc = new BlockchainService(acct);
    try {
      for (let t = 0; t < reps; t++) {
        try {
          console.log(
            `[account ${i + 1}/${totalAccounts} tx ${t + 1}/${reps}] ${acct.address}`,
          );
          await work(svc, acct, i, t);
          stats.ok += 1;
        } catch (err) {
          stats.failed += 1;
          console.error(
            `  FAILED [account ${i + 1}/${totalAccounts} tx ${t + 1}/${reps}] ${acct.address}: ${formatErr(err)}`,
          );
        }
        const isLast =
          i === totalAccounts - 1 && t === reps - 1;
        if (waitMs > 0 && !isLast) await sleep(waitMs);
      }
    } finally {
      clearVolumeSigner();
    }
  }
  return stats;
}

function mergeStats(into: RunStats, from: RunStats) {
  into.ok += from.ok;
  into.failed += from.failed;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || args.command === "help") {
    help();
    return;
  }

  process.env.CELO_RPC = process.env.CELO_RPC ?? "https://forno.celo.org";
  console.log(`Network: Celo mainnet · RPC=${process.env.CELO_RPC}`);
  console.log(`Attribution: ${CELO_ATTRIBUTION_TAG}`);
  console.log(
    `Command=${args.command} count=${args.count} txcount=${args.txcount} wait=${args.wait}ms currency=${args.currency} amount=${args.amount} loop=${args.loop}`,
  );
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.warn(
      "⚠️  FUNDER_KEY is not set — gas top-ups via topUpIfNeeded will fail when balances are low.",
    );
  }

  const all = loadAccounts(args.accountsFile);
  if (!all.length && args.command !== "connect") {
    throw new Error(
      `No accounts loaded from ${args.accountsFile}. Populate with [{ "address", "private_key" }, ...]`,
    );
  }

  const currency = args.currency as PaymentCurrency;
  const totals: RunStats = { ok: 0, failed: 0 };

  for (let round = 0; round < args.loop; round++) {
    // Fresh random selection each outer loop round.
    const selected = selectAccounts(all, args.count);
    if (args.loop > 1) {
      console.log(`\n=== loop ${round + 1}/${args.loop} ===`);
    }
    console.log(
      `Selected ${selected.length} account(s) at random (requested --count ${args.count}):`,
    );
    for (const a of selected) console.log(`  · ${a.address}`);

    try {
      switch (args.command) {
        case "connect": {
          const svc = new BlockchainService(selected[0]);
          console.log(svc.connect());
          totals.ok += 1;
          break;
        }
        case "balance":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log("  balance", await svc.getEmploymentBalance(acct.address, currency));
            }),
          );
          break;
        case "sync-balance":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log("  sync", await svc.syncBalanceCache(acct.address, currency));
            }),
          );
          break;
        case "wallet-token":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log("  token", await svc.getWalletTokenAddress(acct.address));
            }),
          );
          break;
        case "create-wallet":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              const identity = (args.identity ??
                keccak256(toBytes(`volume:${acct.address}`))) as Hex;
              const wallet = await svc.ensureSentryWallet({
                identityHash: identity,
                userKey: acct.address,
                currency,
              });
              console.log("  wallet", wallet, "identity", identity);
            }),
          );
          break;
        case "register":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              const wallet = (args.destination ?? acct.address) as Address;
              console.log("  register", await svc.registerEmploymentOnChain(acct.address, wallet));
            }),
          );
          break;
        case "charge":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              args.wait,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const settlementId = keccak256(
                  toBytes(`settlement:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`),
                );
                console.log(
                  "  charge",
                  await svc.chargeSettlementOnChain({
                    userKey: acct.address,
                    currency,
                    serviceAmount: args.amount,
                    settlementFee: Math.max(args.amount * 0.01, 0.0001),
                    settlementId,
                  }),
                );
              },
            ),
          );
          break;
        case "estimate-fee":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              args.wait,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const settlementId = keccak256(
                  toBytes(`est:${acct.address}:${txIndex}`),
                );
                console.log(
                  "  estimatedFeeCelo",
                  await svc.estimateChargeSettlementFeeCelo({
                    userKey: acct.address,
                    currency,
                    serviceAmount: args.amount,
                    settlementFee: 0.0001,
                    settlementId,
                  }),
                );
              },
            ),
          );
          break;
        case "set-withdrawal":
          if (!args.destination) throw new Error("--destination required");
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log(
                "  setWithdrawal",
                await svc.setWithdrawalDestination(acct.address, args.destination as Address),
              );
            }),
          );
          break;
        case "withdraw":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              args.wait,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const withdrawalId = keccak256(
                  toBytes(`wd:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`),
                );
                console.log(
                  "  withdraw",
                  await svc.withdrawOnChain(
                    acct.address,
                    withdrawalId,
                    args.amount,
                    currency,
                  ),
                );
              },
            ),
          );
          break;
        case "pause":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log("  pause", await svc.pauseOnChain(acct.address));
            }),
          );
          break;
        case "resume":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log("  resume", await svc.resumeOnChain(acct.address));
            }),
          );
          break;
        case "notify-funding":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              console.log(
                "  notify",
                await svc.notifyWalletFunding(
                  acct.address,
                  acct.address,
                  args.amount,
                  currency,
                ),
              );
            }),
          );
          break;
        case "set-currency": {
          withVolumeSigner(selected[0]!);
          const svc = new BlockchainService(selected[0]);
          try {
            console.log(
              "  setCurrencyEnabled",
              await svc.setCurrencyEnabled(currency, args.enabled ?? true),
            );
            totals.ok += 1;
          } catch (err) {
            totals.failed += 1;
            console.error(`  FAILED set-currency: ${formatErr(err)}`);
          } finally {
            clearVolumeSigner();
          }
          break;
        }
        case "update-token": {
          if (!args.destination) throw new Error("--destination token address required");
          withVolumeSigner(selected[0]!);
          const svc = new BlockchainService(selected[0]);
          try {
            console.log(
              "  updateTokenAddress",
              await svc.updateTokenAddress(currency, args.destination as Address),
            );
            totals.ok += 1;
          } catch (err) {
            totals.failed += 1;
            console.error(`  FAILED update-token: ${formatErr(err)}`);
          } finally {
            clearVolumeSigner();
          }
          break;
        }
        case "create-reward":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              const accountKey = keccak256(toBytes(`reward:${acct.address}`));
              console.log(
                "  rewardAccount",
                await svc.ensureRewardAccount({ accountKey, currency }),
                "key",
                accountKey,
              );
            }),
          );
          break;
        case "reward-balance": {
          const target = (args.destination ?? selected[0]?.address) as Address;
          const svc = new BlockchainService(selected[0]);
          try {
            console.log("  rewardBalance", await svc.rewardAccountBalance(target));
            totals.ok += 1;
          } catch (err) {
            totals.failed += 1;
            console.error(`  FAILED reward-balance: ${formatErr(err)}`);
          }
          break;
        }
        case "reward-payout":
          if (!args.destination) throw new Error("--destination reward account required");
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              args.wait,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const payoutId = keccak256(
                  toBytes(`payout:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`),
                );
                const decimals = currency === "USDC" || currency === "USDT" ? 6 : 18;
                console.log(
                  "  payout",
                  await svc.payoutReward({
                    accountAddress: args.destination as Address,
                    to: acct.address,
                    amount: parseUnits(String(args.amount), decimals),
                    payoutId,
                  }),
                );
              },
            ),
          );
          break;
        case "pause-reward":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              const key = keccak256(toBytes(`reward:${acct.address}`)) as Hex;
              console.log("  pauseReward", await svc.pauseRewardAccount(key));
            }),
          );
          break;
        case "resume-reward":
          mergeStats(
            totals,
            await forEachAccount(selected, args.wait, args.txcount, async (svc, acct) => {
              const key = keccak256(toBytes(`reward:${acct.address}`)) as Hex;
              console.log("  resumeReward", await svc.resumeRewardAccount(key));
            }),
          );
          break;
        case "transfer":
        case "volume":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              args.wait,
              args.txcount,
              async (svc, acct, accountIndex) => {
                const to =
                  (args.destination as Address | undefined) ??
                  selected[(accountIndex + 1) % selected.length]!.address;
                const hash = await svc.sendNativeAttributed({
                  to,
                  amountWei: parseEther(String(args.amount)),
                });
                console.log(`  ${args.command} ${acct.address} -> ${to}`, hash);
              },
            ),
          );
          break;
        default:
          console.error(`Unknown command: ${args.command}`);
          help();
          process.exitCode = 1;
      }
    } catch (err) {
      totals.failed += 1;
      console.error(
        `  FAILED loop ${round + 1}/${args.loop} (${args.command}): ${formatErr(err)}`,
      );
    }
  }

  console.log(`\nDone. ok=${totals.ok} failed=${totals.failed}`);
  if (totals.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
