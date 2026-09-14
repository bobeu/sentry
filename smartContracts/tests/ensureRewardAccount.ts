/**
 * ensureRewardAccount — create multi-currency RewardAccount for employer.
 *
 * Flow (owner = NEW_OWNER):
 *   createAccount(accountKey, employer=employerEOA) if missing
 *   Optional --fund into the RewardAccount
 *
 * Usage:
 *   bun run ensure:reward-account --count 5 --fund --fund-min 0.01 --fund-max 0.05 --cur USDm
 */
import { ensureRewardAccount } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureRewardAccount — create RewardAccount (employer = accounts.json EOA)

  bun run ensure:reward-account --count N [--fund] [--fund-min A --fund-max B] [--cur USDm]
`;

runEnsureScript({
  name: "ensureRewardAccount",
  helpText: HELP,
  work: async (svc, employer, _i, _t, args) => {
    const ready = await ensureRewardAccount(svc, employer, args);
    console.log(`  ok account=${ready.accountAddress}`);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
