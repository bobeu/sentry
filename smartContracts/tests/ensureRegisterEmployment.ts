/**
 * ensureRegisterEmployment
 *
 * Flow (owner = NEW_OWNER):
 *   1. If EmploymentManager.walletOf(employerEOA) exists → use it
 *   2. Else createWallet(identity, userKey=employerEOA) then
 *      registerEmployment(user=employerEOA, wallet=SentryWallet)
 *   3. If --fund: fund the employment wallet
 *
 * Usage:
 *   bun run ensure:register --count 10 --wait 5
 *   bun run ensure:register --count 5 --fund --fund-min 0.02 --fund-max 0.09
 */
import { ensureRegisterEmployment } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureRegisterEmployment — hire Sentry for employer EOAs in accounts.json

  bun run ensure:register --count N [--wait S] [--cur CELO]
    [--fund] [--fund-min A --fund-max B] [--min A --max B]

Roles:
  accounts.json  employer EOA (= userKey for registerEmployment)
  NEW_OWNER      factory/manager owner (createWallet + registerEmployment)
  FUNDER_KEY     optional funding + gas top-ups
`;

runEnsureScript({
  name: "ensureRegisterEmployment",
  helpText: HELP,
  work: async (svc, employer, _i, _t, args) => {
    const wallet = await ensureRegisterEmployment(svc, employer, args);
    console.log(`  ok wallet=${wallet}`);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
