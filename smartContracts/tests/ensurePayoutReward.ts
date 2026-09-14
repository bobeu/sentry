/**
 * ensurePayoutReward
 *
 * Flow:
 *   1. ensureRewardAccount
 *   2. Fund RewardAccount if balance < payout
 *   3. Operator: RewardFactory.payout(...)
 *
 * Usage:
 *   bun run ensure:payout-reward --count 5 --min 0.001 --max 0.01 --cur USDm \\
 *     --destination 0xMember...
 */
import { ensurePayoutReward } from "./lib/flow";
import { runEnsureScript } from "./lib/runner";

const HELP = `
ensurePayoutReward — ensure reward account, fund if needed, operator payout

  bun run ensure:payout-reward --count N --min A --max B [--cur USDm]
    [--destination 0x...] [--fund-min FMIN --fund-max FMAX]
`;

runEnsureScript({
  name: "ensurePayoutReward",
  helpText: HELP,
  work: async (svc, employer, _i, txIndex, args) => {
    await ensurePayoutReward(svc, employer, args, txIndex);
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
