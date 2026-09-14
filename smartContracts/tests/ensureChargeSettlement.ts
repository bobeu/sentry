/**
 * ensureChargeSettlement
 *
 * Flow:
 *   1. ensureRegisterEmployment (create wallet + register if needed)
 *   2. Ensure employment wallet funded (fund via --fund-min/--fund-max or --min/--max)
 *   3. Operator (NEW_OWNER): chargeSettlement(user=employerEOA, ...)
 *
 * Usage:
 *   bun run ensure:charge --count 10 --cur celo --min 0.001 --max 0.02 \\
 *     --fund-min 0.02 --fund-max 0.09 --wait 5
 */
import { ensureChargeSettlement } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureChargeSettlement — register employment if needed, fund wallet, charge

  bun run ensure:charge --count N --min SETTLE_MIN --max SETTLE_MAX
    [--fund-min FMIN --fund-max FMAX] [--wait S] [--cur CELO]

chargeSettlement args use employer EOA as user (never the SentryWallet address).
`;

runEnsureScript({
  name: "ensureChargeSettlement",
  helpText: HELP,
  work: async (svc, employer, _i, txIndex, args) => {
    await ensureChargeSettlement(svc, employer, args, txIndex);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
