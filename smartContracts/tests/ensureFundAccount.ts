/**
 * ensureFundAccount — ensure employment registered, then fund the SentryWallet.
 *
 * Usage:
 *   bun run ensure:fund --count 10 --fund-min 0.02 --fund-max 0.09 --cur CELO
 */
import { ensureFundAccount } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensureFundAccount — register employment if needed, then fund SentryWallet

  bun run ensure:fund --count N --fund-min A --fund-max B [--cur CELO] [--wait S]
`;

runEnsureScript({
  name: "ensureFundAccount",
  helpText: HELP,
  work: async (svc, employer, _i, _t, args) => {
    await ensureFundAccount(svc, employer, args);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
