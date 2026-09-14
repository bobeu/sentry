/**
 * ensureWithdrawRewardToEmployer
 *
 * Flow:
 *   1. ensureRewardAccount (optionally --fund)
 *   2. Operator: withdrawToEmployer(accountKey, pending*)
 *
 * Usage:
 *   bun run ensure:withdraw-reward --count 5 [--fund --fund-min 0.01 --fund-max 0.05]
 */
import { ensureWithdrawRewardToEmployer } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureWithdrawRewardToEmployer — ensure reward account, withdraw surplus to employer

  bun run ensure:withdraw-reward --count N [--fund] [--fund-min A --fund-max B]
`;

runEnsureScript({
  name: "ensureWithdrawRewardToEmployer",
  helpText: HELP,
  work: async (svc, employer, _i, _t, args) => {
    await ensureWithdrawRewardToEmployer(svc, employer, args);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
