/**
 * Correct on-chain flows (mirrors UI wallet.service + EmploymentManager):
 *
 * Employment:
 *   1. Owner: createWallet(identityHash, userKey=employerEOA, currency)
 *   2. Owner: registerEmployment(user=employerEOA, wallet=SentryWallet)
 *      — user is the employer EOA; wallet is NEVER an EOA
 *   3. Funder/employer: transfer → SentryWallet
 *   4. Operator (NEW_OWNER): chargeSettlement / setWithdrawalDestination / withdraw
 *
 * Rewards:
 *   1. Owner: createAccount(accountKey, employerEOA)
 *   2. Funder: transfer → RewardAccount
 *   3. Operator: payout / withdrawToEmployer
 */
import {
  keccak256,
  parseUnits,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import type { BlockchainService } from "../blockchain.service";
import {
  resolveAmount,
  resolveFundAmount,
  type CliArgs,
  type VolumeAccount,
} from "./accounts";
import type { PaymentCurrency } from "./payment-currency";
import { tokenDecimals } from "./payment-currency";

function identityForEmployer(employer: Address, identityOverride?: string): Hex {
  if (identityOverride?.startsWith("0x") && identityOverride.length === 66) {
    return identityOverride as Hex;
  }
  return keccak256(toBytes(`volume:${employer}`));
}

function rewardKeyForEmployer(employer: Address): Hex {
  return keccak256(toBytes(`reward:${employer}`));
}

function currencyOf(args: CliArgs): PaymentCurrency {
  return args.currency;
}

/**
 * Ensure employment exists for employer EOA.
 * Creates SentryWallet (if needed) then registerEmployment(employerEOA, wallet).
 * Optionally funds the employment wallet when --fund / fund range is set.
 */
export async function ensureRegisterEmployment(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
): Promise<Address> {
  const userKey = employer.address;
  const currency = currencyOf(args);

  let wallet = await svc.employmentWalletOf(userKey);
  if (wallet) {
    console.log(`  employment already registered: user=${userKey} wallet=${wallet}`);
  } else {
    const identityHash = identityForEmployer(userKey, args.identity);
    // Owner path — may no-op if factory already has a wallet for this userKey.
    wallet = await svc.ensureSentryWallet({
      identityHash,
      userKey,
      currency,
    });
    console.log(`  sentry wallet ready: ${wallet}`);

    // registerEmployment(user=EOA, wallet=SentryWallet) — matches UI + contract NatSpec.
    await svc.registerEmploymentOnChain(userKey, wallet);
    console.log(`  registered employment: user=${userKey} → wallet=${wallet}`);
  }

  if (args.fund) {
    const fundAmt = resolveFundAmount(args);
    if (fundAmt !== undefined && fundAmt > 0) {
      const hash = await svc.fundEmploymentWallet({
        walletAddress: wallet,
        currency,
        amount: fundAmt,
      });
      console.log(`  funded employment wallet ${fundAmt} ${currency}`, hash);
    }
  }

  return wallet;
}

/**
 * Ensure wallet balance can cover `needAmount` (token units). Funds with
 * random --fund-min/--fund-max (else --min/--max) when short.
 */
export async function ensureEmploymentFunded(
  svc: BlockchainService,
  wallet: Address,
  args: CliArgs,
  needAmount: number,
): Promise<void> {
  const currency = currencyOf(args);
  const bal = await svc.getEmploymentBalance(wallet, currency);
  const current = bal?.balance != null ? Number(bal.balance) : 0;
  if (Number.isFinite(current) && current >= needAmount) {
    console.log(`  employment funded enough: ${current} ${currency} ≥ ${needAmount}`);
    return;
  }

  const fundAmt = resolveFundAmount(args);
  const topUp =
    fundAmt !== undefined && fundAmt > 0
      ? Math.max(fundAmt, needAmount)
      : Math.max(needAmount, args.amount);
  if (topUp <= 0) {
    throw new Error(
      `Employment wallet underfunded (${current} ${currency}) and no fund amount resolved. Pass --fund-min/--fund-max or --min/--max.`,
    );
  }
  const hash = await svc.fundEmploymentWallet({
    walletAddress: wallet,
    currency,
    amount: topUp,
  });
  console.log(
    `  funded employment wallet ${topUp} ${currency} (was ${current}, need ${needAmount})`,
    hash,
  );
}

/**
 * Charge settlement: register employment → ensure funded → operator chargeSettlement(userKey=EOA).
 */
export async function ensureChargeSettlement(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
  txIndex: number,
): Promise<void> {
  const userKey = employer.address;
  const currency = currencyOf(args);
  const wallet = await ensureRegisterEmployment(svc, employer, {
    ...args,
    fund: false,
  });

  const serviceAmount = resolveAmount(args);
  const settlementFee = Math.max(serviceAmount * 0.01, 0.0001);
  const need = serviceAmount + settlementFee;
  await ensureEmploymentFunded(svc, wallet, args, need);

  const settlementId = keccak256(
    toBytes(
      `settlement:${userKey}:${Date.now()}:${txIndex}:${Math.random()}`,
    ),
  );
  const hash = await svc.chargeSettlementOnChain({
    userKey,
    currency,
    serviceAmount,
    settlementFee,
    settlementId,
  });
  console.log(
    `  chargeSettlement user=${userKey} amount=${serviceAmount} fee=${settlementFee} ${currency}`,
    hash,
  );
}

/**
 * Withdraw: register → set destination to employer EOA → operator withdraw.
 */
export async function ensureWithdraw(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
  txIndex: number,
): Promise<void> {
  const userKey = employer.address;
  const currency = currencyOf(args);
  const wallet = await ensureRegisterEmployment(svc, employer, {
    ...args,
    fund: false,
  });

  const amount = resolveAmount(args);
  await ensureEmploymentFunded(svc, wallet, args, amount);

  const destination = (args.destination as Address | undefined) ?? userKey;
  await svc.setWithdrawalDestination(userKey, destination);
  console.log(`  withdrawal destination set → ${destination}`);

  const withdrawalId = keccak256(
    toBytes(`wd:${userKey}:${Date.now()}:${txIndex}:${Math.random()}`),
  );
  const hash = await svc.withdrawOnChain(
    userKey,
    withdrawalId,
    amount,
    currency,
  );
  console.log(`  withdraw user=${userKey} amount=${amount} ${currency}`, hash);
}

/**
 * Create (or return) RewardAccount for employer. Optionally fund with --fund.
 */
export async function ensureRewardAccount(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
): Promise<{ accountKey: Hex; accountAddress: Address }> {
  const accountKey = rewardKeyForEmployer(employer.address);
  const accountAddress = await svc.ensureRewardAccount({
    accountKey,
    employer: employer.address,
  });
  console.log(
    `  reward account ${accountAddress} key=${accountKey} employer=${employer.address}`,
  );

  if (args.fund) {
    const fundAmt = resolveFundAmount(args);
    if (fundAmt !== undefined && fundAmt > 0) {
      const hash = await svc.fundRewardAccount({
        accountAddress,
        currency: currencyOf(args),
        amount: fundAmt,
      });
      console.log(`  funded reward ${fundAmt} ${args.currency}`, hash);
    }
  }

  return { accountKey, accountAddress };
}

/**
 * Fund employment wallet (after ensuring registration).
 * Amount from --fund-min/--fund-max or --min/--max.
 */
export async function ensureFundAccount(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
): Promise<void> {
  const wallet = await ensureRegisterEmployment(svc, employer, {
    ...args,
    fund: false,
  });
  const fundAmt = resolveFundAmount({ ...args, fund: true });
  if (fundAmt === undefined || fundAmt <= 0) {
    throw new Error("Pass --min/--max or --fund-min/--fund-max (or --amount) to fund");
  }
  const hash = await svc.fundEmploymentWallet({
    walletAddress: wallet,
    currency: currencyOf(args),
    amount: fundAmt,
  });
  console.log(`  funded employment ${fundAmt} ${args.currency} → ${wallet}`, hash);
}

/**
 * Payout reward: ensure reward account → fund if needed → operator payout.
 */
export async function ensurePayoutReward(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
  txIndex: number,
): Promise<void> {
  const currency = currencyOf(args);
  const { accountKey, accountAddress } = await ensureRewardAccount(svc, employer, {
    ...args,
    fund: false,
  });

  const amount = resolveAmount(args);
  const bal = await svc.rewardAccountBalance(accountAddress, currency);
  const need = parseUnits(String(amount), tokenDecimals(currency));
  if (bal < need) {
    const fundAmt = resolveFundAmount({ ...args, fund: true });
    const topUp =
      fundAmt !== undefined && fundAmt > 0
        ? Math.max(fundAmt, amount)
        : amount;
    await svc.fundRewardAccount({
      accountAddress,
      currency,
      amount: topUp,
    });
    console.log(`  funded reward ${topUp} ${currency} before payout`);
  }

  const to = (args.destination as Address | undefined) ?? employer.address;
  const payoutId = keccak256(
    toBytes(`payout:${employer.address}:${Date.now()}:${txIndex}:${Math.random()}`),
  );
  const hash = await svc.payoutReward({
    accountKey,
    to,
    amount: need,
    payoutId,
    currency,
  });
  console.log(`  payout ${amount} ${currency} → ${to}`, hash);
}

/**
 * Withdraw surplus from RewardAccount to employer via factory operator.
 */
export async function ensureWithdrawRewardToEmployer(
  svc: BlockchainService,
  employer: VolumeAccount,
  args: CliArgs,
): Promise<void> {
  const { accountKey } = await ensureRewardAccount(svc, employer, {
    ...args,
    fund: args.fund,
  });
  const hash = await svc.withdrawRewardToEmployer({ accountKey });
  console.log(`  withdrawToEmployer key=${accountKey}`, hash);
}
