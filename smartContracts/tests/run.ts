/**
 * Celo mainnet volume CLI — drives every BlockchainService method using
 * private keys from accounts.json (viem, no wallet provider).
 *
 * Usage:
 *   npx tsx tests/run.ts <command> [--count N] [--txcount N] [--wait SECONDS]
 *     [--currency|--cur CELO|USDm|USDC|USDT] [--amount N] [--min N] [--max N]
 *     [--fundmin N] [--fundmax N] [--loop N] [--accounts path] [--destination 0x...]
 *
 * Network: Celo mainnet (42220) only. Attribution: celo_e3cc4c8d8a0e
 *
 * Roles:
 *   Owner env key  — create wallet / register / create reward account
 *   accounts.json  — operator identity (userKey) for charge / payout / pause
 *   FUNDER_KEY     — funds employment + reward wallets
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
  resolveAmount,
  resolveFundAmount,
  selectAccounts,
  sleep,
  type CliArgs,
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
  create-wallet           ensureSentryWallet (owner key)
  register                registerEmploymentOnChain (owner; never defaults to EOA)
  charge                  ensureEmploymentReady → chargeSettlementOnChain
  estimate-fee            estimateChargeSettlementFeeCelo
  set-withdrawal          setWithdrawalDestination
  withdraw                ensureEmploymentReady → withdrawOnChain
  pause                   pauseOnChain
  resume                  resumeOnChain
  notify-funding          notifyWalletFunding
  set-currency            setCurrencyEnabled (--enabled true|false)
  update-token            updateTokenAddress (--destination = token addr)
  create-reward           ensureRewardAccount (employer = EMPLOYER_ADDRESS|FUNDER)
  reward-balance          rewardAccountBalance
  reward-payout           ensureRewardReady → factory payout
  pause-reward            pauseAccountByOperator
  resume-reward           resumeAccountByOperator
  withdraw-reward         withdrawToEmployer (full balance → employer)
  transfer                sendNativeAttributed (CELO volume with attribution)
  volume                  loop transfer across accounts for high tx count

Flags:
  --count N         randomly select N accounts from accounts.json (default 1)
  --txcount N       run the command N times per selected account (default 1)
  --wait SECONDS    delay between txs in seconds (default 1.5). Example: --wait 5
  --currency|--cur  CELO | USDm | USDC | USDT (default CELO)
  --amount N        fixed amount in token units (default 0.001)
  --min / --max     random charge/payout/transfer amount in range (overrides --amount)
  --fundmin/max     random fund into employment/reward wallet before mutating cmds
  --loop N          outer batch repeat; re-selects random accounts each round (default 1)
  --accounts PATH   path to accounts.json
  --destination 0x  extra address (withdrawal / payout target / token)
  --identity HEX    identityHash for create-wallet (default keccak of volume:addr)
  --enabled true    for set-currency

Example:
  bun run vol:charge --cur celo --count 10 --fundmin 0.1 --fundmax 0.5 --min 0.001 --max 0.1 --wait 5

Env:
  FUNDER_KEY              funds employment/reward wallets + gas top-ups
  EMPLOYER_ADDRESS        optional employer receive addr for create-reward
  EMPLOYMENT_OWNER_KEY / SENTRY_OWNER_KEY
  EMPLOYMENT_OPERATOR_KEY (or VOLUME_SIGNER_KEY via accounts.json)
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

function waitMs(args: CliArgs): number {
  return Math.max(0, args.wait) * 1000;
}

/**
 * Owner path: create SentryWallet + register employment (never register EOA).
 * Optionally fund the employment wallet from FUNDER_KEY when fundmin/max set
 * or `forceFund` is true.
 */
async function ensureEmploymentReady(
  svc: BlockchainService,
  acct: VolumeAccount,
  currency: PaymentCurrency,
  args: CliArgs,
  opts?: { fund?: boolean },
): Promise<Address> {
  const identity = (args.identity ??
    keccak256(toBytes(`volume:${acct.address}`))) as Hex;
  const wallet = await svc.ensureSentryWallet({
    identityHash: identity,
    userKey: acct.address,
    currency,
  });
  console.log(`  ready wallet ${wallet}`);
  await svc.registerEmploymentOnChain(acct.address, wallet);
  console.log(`  registered ${acct.address} → ${wallet}`);

  if (opts?.fund) {
    const fundAmt = resolveFundAmount(args);
    if (fundAmt !== undefined && fundAmt > 0) {
      const hash = await svc.fundEmploymentWallet({
        walletAddress: wallet,
        currency,
        amount: fundAmt,
      });
      console.log(`  funded employment ${fundAmt} ${currency}`, hash);
    }
  }
  return wallet;
}

/**
 * Ensure reward account exists (employer immutable), optionally fund it.
 */
async function ensureRewardReady(
  svc: BlockchainService,
  acct: VolumeAccount,
  currency: PaymentCurrency,
  args: CliArgs,
  opts?: { fund?: boolean; fundFallbackAmount?: boolean },
): Promise<{ accountKey: Hex; accountAddress: Address }> {
  const accountKey = keccak256(toBytes(`reward:${acct.address}`)) as Hex;
  const employer = svc.resolveEmployerAddress();
  const accountAddress = await svc.ensureRewardAccount({
    accountKey,
    currency,
    employer,
  });
  console.log(`  reward account ${accountAddress} employer=${employer}`);

  if (opts?.fund) {
    const fundAmt =
      resolveFundAmount(args) ??
      (opts.fundFallbackAmount ? resolveAmount(args) : undefined);
    if (fundAmt !== undefined && fundAmt > 0) {
      const hash = await svc.fundRewardAccount({
        accountAddress,
        currency,
        amount: fundAmt,
      });
      console.log(`  funded reward ${fundAmt} ${currency}`, hash);
    }
  }
  return { accountKey, accountAddress };
}

/**
 * For each selected account, run `work` exactly `txcount` times.
 * Failures are caught per tx so one bad send does not block the next.
 */
async function forEachAccount(
  accounts: VolumeAccount[],
  waitMilliseconds: number,
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
        const isLast = i === totalAccounts - 1 && t === reps - 1;
        if (waitMilliseconds > 0 && !isLast) await sleep(waitMilliseconds);
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
    `Command=${args.command} count=${args.count} txcount=${args.txcount} wait=${args.wait}s currency=${args.currency} amount=${args.amount} min=${args.min ?? "-"} max=${args.max ?? "-"} fundmin=${args.fundmin ?? "-"} fundmax=${args.fundmax ?? "-"} loop=${args.loop}`,
  );
  if (!(process.env.FUNDER_KEY || "").trim()) {
    console.warn(
      "⚠️  FUNDER_KEY is not set — funding + gas top-ups will fail when balances are low.",
    );
  }

  const all = loadAccounts(args.accountsFile);
  if (!all.length && args.command !== "connect") {
    throw new Error(
      `No accounts loaded from ${args.accountsFile}. Populate with [{ "address", "private_key" }, ...]`,
    );
  }

  const currency = args.currency as PaymentCurrency;
  const delay = waitMs(args);
  const totals: RunStats = { ok: 0, failed: 0 };

  for (let round = 0; round < args.loop; round++) {
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
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log("  balance", await svc.getEmploymentBalance(acct.address, currency));
            }),
          );
          break;
        case "sync-balance":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log("  sync", await svc.syncBalanceCache(acct.address, currency));
            }),
          );
          break;
        case "wallet-token":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log("  token", await svc.getWalletTokenAddress(acct.address));
            }),
          );
          break;
        case "create-wallet":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const wallet = await ensureEmploymentReady(svc, acct, currency, args);
              console.log("  wallet", wallet);
            }),
          );
          break;
        case "register":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const wallet = await ensureEmploymentReady(svc, acct, currency, args);
              console.log("  register ok", wallet);
            }),
          );
          break;
        case "charge":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              delay,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const shouldFund =
                  args.fundmin !== undefined || args.fundmax !== undefined;
                const wallet = await ensureEmploymentReady(
                  svc,
                  acct,
                  currency,
                  args,
                  { fund: shouldFund && txIndex === 0 },
                );
                if (shouldFund && txIndex > 0) {
                  const fundAmt = resolveFundAmount(args);
                  if (fundAmt !== undefined && fundAmt > 0) {
                    await svc.fundEmploymentWallet({
                      walletAddress: wallet,
                      currency,
                      amount: fundAmt,
                    });
                    console.log(`  funded employment ${fundAmt} ${currency}`);
                  }
                }
                const amount = resolveAmount(args);
                const settlementId = keccak256(
                  toBytes(
                    `settlement:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`,
                  ),
                );
                console.log(
                  "  charge",
                  amount,
                  currency,
                  await svc.chargeSettlementOnChain({
                    userKey: acct.address,
                    currency,
                    serviceAmount: amount,
                    settlementFee: Math.max(amount * 0.01, 0.0001),
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
              delay,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const amount = resolveAmount(args);
                const settlementId = keccak256(
                  toBytes(`est:${acct.address}:${txIndex}`),
                );
                console.log(
                  "  estimatedFeeCelo",
                  await svc.estimateChargeSettlementFeeCelo({
                    userKey: acct.address,
                    currency,
                    serviceAmount: amount,
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
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log(
                "  setWithdrawal",
                await svc.setWithdrawalDestination(
                  acct.address,
                  args.destination as Address,
                ),
              );
            }),
          );
          break;
        case "withdraw":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              delay,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                await ensureEmploymentReady(svc, acct, currency, args);
                const amount = resolveAmount(args);
                const withdrawalId = keccak256(
                  toBytes(
                    `wd:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`,
                  ),
                );
                console.log(
                  "  withdraw",
                  await svc.withdrawOnChain(
                    acct.address,
                    withdrawalId,
                    amount,
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
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log("  pause", await svc.pauseOnChain(acct.address));
            }),
          );
          break;
        case "resume":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              console.log("  resume", await svc.resumeOnChain(acct.address));
            }),
          );
          break;
        case "notify-funding":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const amount = resolveAmount(args);
              console.log(
                "  notify",
                await svc.notifyWalletFunding(
                  acct.address,
                  acct.address,
                  amount,
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
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const ready = await ensureRewardReady(svc, acct, currency, args);
              console.log("  rewardAccount", ready.accountAddress, "key", ready.accountKey);
            }),
          );
          break;
        case "reward-balance":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const { accountAddress } = await ensureRewardReady(
                svc,
                acct,
                currency,
                args,
              );
              const target = (args.destination as Address | undefined) ?? accountAddress;
              console.log("  rewardBalance", await svc.rewardAccountBalance(target));
            }),
          );
          break;
        case "reward-payout":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              delay,
              args.txcount,
              async (svc, acct, _i, txIndex) => {
                const { accountKey } = await ensureRewardReady(
                  svc,
                  acct,
                  currency,
                  args,
                  {
                    fund: true,
                    fundFallbackAmount: true,
                  },
                );
                const amount = resolveAmount(args);
                const decimals = currency === "USDC" || currency === "USDT" ? 6 : 18;
                const payoutId = keccak256(
                  toBytes(
                    `payout:${acct.address}:${Date.now()}:${txIndex}:${Math.random()}`,
                  ),
                );
                const to = (args.destination as Address | undefined) ?? acct.address;
                console.log(
                  "  payout",
                  amount,
                  currency,
                  await svc.payoutReward({
                    accountKey,
                    to,
                    amount: parseUnits(String(amount), decimals),
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
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const { accountKey } = await ensureRewardReady(svc, acct, currency, args);
              console.log(
                "  pauseReward",
                await svc.pauseRewardAccountByOperator(accountKey),
              );
            }),
          );
          break;
        case "resume-reward":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const { accountKey } = await ensureRewardReady(svc, acct, currency, args);
              console.log(
                "  resumeReward",
                await svc.resumeRewardAccountByOperator(accountKey),
              );
            }),
          );
          break;
        case "withdraw-reward":
          mergeStats(
            totals,
            await forEachAccount(selected, delay, args.txcount, async (svc, acct) => {
              const { accountKey } = await ensureRewardReady(
                svc,
                acct,
                currency,
                args,
                {
                  fund:
                    args.fundmin !== undefined || args.fundmax !== undefined,
                },
              );
              console.log(
                "  withdrawToEmployer",
                await svc.withdrawRewardToEmployer(accountKey),
              );
            }),
          );
          break;
        case "transfer":
        case "volume":
          mergeStats(
            totals,
            await forEachAccount(
              selected,
              delay,
              args.txcount,
              async (svc, acct, accountIndex) => {
                const to =
                  (args.destination as Address | undefined) ??
                  selected[(accountIndex + 1) % selected.length]!.address;
                const amount = resolveAmount(args);
                const hash = await svc.sendNativeAttributed({
                  to,
                  amountWei: parseEther(String(amount)),
                });
                console.log(`  ${args.command} ${acct.address} -> ${to} ${amount}`, hash);
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
