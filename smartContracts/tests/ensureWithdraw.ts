/**
 * ensureWithdraw
 *
 * Flow:
 *   1. ensureRegisterEmployment
 *   2. Ensure funded for withdraw amount
 *   3. Operator: setWithdrawalDestination(user=employerEOA, dest)
 *   4. Operator: withdraw(user=employerEOA, ...)
 *
 * Usage:
 *   bun run ensure:withdraw --count 5 --min 0.001 --max 0.01 --fund-min 0.02 --fund-max 0.05
 */
import { ensureWithdraw } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureWithdraw — register if needed, fund, set destination, withdraw

  bun run ensure:withdraw --count N --min A --max B
    [--fund-min FMIN --fund-max FMAX] [--destination 0x...] [--wait S]
`;

runEnsureScript({
  name: "ensureWithdraw",
  helpText: HELP,
  work: async (svc, employer, _i, txIndex, args) => {
    await ensureWithdraw(svc, employer, args, txIndex);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
