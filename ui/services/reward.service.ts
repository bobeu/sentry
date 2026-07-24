import { createHash, randomBytes } from "crypto";
import {
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { prisma } from "@/lib/prisma";
import {
  formatAmount,
  isPaymentCurrency,
  tokenDecimals,
  type PaymentCurrency,
} from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";
import { actionService } from "@/services/action.service";

function accountKeyForGroup(telegramGroupId: string): Hex {
  return keccak256(toBytes(`telegram-group:${telegramGroupId}`));
}

function payoutIdHex(seed: string): Hex {
  return keccak256(toBytes(seed));
}

function decimalNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value == null) return 0;
  return Number(value.toString());
}

export class RewardService {
  /**
   * Ensure a multi-currency RewardAccount exists for the group (on-chain + DB).
   * Employer manages via Sentry; only the operator key can payout / withdraw surplus.
   */
  async ensureRewardAccount(input: {
    groupId: string;
    ownerUserId: string;
    /** Ignored for on-chain create (multi-currency). Kept for API compatibility. */
    currency?: PaymentCurrency;
    bill?: boolean;
  }) {
    const existing = await prisma.rewardAccount.findUnique({
      where: { groupId: input.groupId },
    });
    if (existing && existing.status !== "Archived") {
      return existing;
    }

    const group = await prisma.telegramGroup.findUnique({
      where: { id: input.groupId },
    });
    if (!group) throw new Error("Group not found");

    const accountKey = accountKeyForGroup(group.telegramId);

    const ownerUser = await prisma.user.findUnique({
      where: { id: input.ownerUserId },
      select: {
        withdrawalAddress: true,
        pendingWithdrawalAddress: true,
      },
    });
    const employerRaw =
      ownerUser?.withdrawalAddress ??
      ownerUser?.pendingWithdrawalAddress ??
      "";
    if (!isAddress(employerRaw)) {
      throw new Error(
        "Set a withdrawal destination on your account before creating a RewardAccount (employer receive address).",
      );
    }
    const employer = getAddress(employerRaw) as Address;

    const address = await blockchainService.ensureRewardAccount({
      accountKey,
      employer,
    });

    const row = await prisma.rewardAccount.upsert({
      where: { groupId: input.groupId },
      create: {
        groupId: input.groupId,
        ownerUserId: input.ownerUserId,
        address,
        accountKey,
        currency: "MULTI",
        status: "Active",
      },
      update: {
        address,
        accountKey,
        currency: "MULTI",
        status: "Active",
        ownerUserId: input.ownerUserId,
      },
    });

    if (input.bill !== false) {
      await this.billConfigAction({
        userId: input.ownerUserId,
        groupId: input.groupId,
        op: "create",
        metadata: { address, currency: "MULTI" },
      });
    }

    return row;
  }

  async getAccount(groupId: string) {
    return prisma.rewardAccount.findUnique({ where: { groupId } });
  }

  /** Bill employment wallet for a RewardAccount config action (usual fee). */
  async billConfigAction(input: {
    userId: string;
    groupId: string;
    op:
      | "create"
      | "pause"
      | "resume"
      | "setAccountOperator"
      | "archive"
      | "status";
    metadata?: Record<string, unknown>;
  }) {
    return actionService.record({
      type: "reward_account_config",
      userId: input.userId,
      groupId: input.groupId,
      billable: true,
      metadata: { op: input.op, ...(input.metadata ?? {}) },
    });
  }

  async pauseRewards(groupId: string, viaOnChain = true, billUserId?: string) {
    await prisma.groupSettings.update({
      where: { groupId },
      data: { rewardPaused: true },
    });
    const account = await prisma.rewardAccount.findUnique({ where: { groupId } });
    if (account && viaOnChain) {
      try {
        await blockchainService.pauseRewardAccount(account.accountKey as Hex);
        await prisma.rewardAccount.update({
          where: { id: account.id },
          data: { status: "Paused" },
        });
      } catch (err) {
        console.warn("[reward] on-chain pause failed; DB paused anyway", err);
      }
    }
    if (billUserId) {
      await this.billConfigAction({
        userId: billUserId,
        groupId,
        op: "pause",
        metadata: { viaOnChain, address: account?.address },
      });
    }
  }

  async resumeRewards(groupId: string, viaOnChain = true, billUserId?: string) {
    await prisma.groupSettings.update({
      where: { groupId },
      data: { rewardPaused: false, rewardEnabled: true },
    });
    const account = await prisma.rewardAccount.findUnique({ where: { groupId } });
    if (account && viaOnChain) {
      try {
        await blockchainService.resumeRewardAccount(account.accountKey as Hex);
        await prisma.rewardAccount.update({
          where: { id: account.id },
          data: { status: "Active" },
        });
      } catch (err) {
        console.warn("[reward] on-chain resume failed; DB resumed anyway", err);
      }
    }
    if (billUserId) {
      await this.billConfigAction({
        userId: billUserId,
        groupId,
        op: "resume",
        metadata: { viaOnChain, address: account?.address },
      });
    }
  }

  /**
   * Rotate on-chain payout operator for a group's RewardAccount (factory.setAccountOperator).
   */
  async setAccountOperator(input: {
    groupId: string;
    userId: string;
    newOperator: string;
    bill?: boolean;
  }) {
    if (!isAddress(input.newOperator)) {
      throw new Error("Invalid operator address — provide a valid 0x wallet.");
    }
    const operator = getAddress(input.newOperator) as Address;
    const account = await prisma.rewardAccount.findUnique({
      where: { groupId: input.groupId },
    });
    if (!account) {
      throw new Error(
        "No RewardAccount for this group yet. Create one first (Wallets → Reward Account).",
      );
    }
    if (account.status === "Archived") {
      throw new Error("This RewardAccount is archived and cannot change operator.");
    }
    if (!blockchainService.isRewardFactoryConfigured()) {
      throw new Error("RewardFactory is not configured on this deployment.");
    }

    const txHash = await blockchainService.setRewardAccountOperator(
      account.accountKey as Hex,
      operator,
    );

    if (input.bill !== false) {
      await this.billConfigAction({
        userId: input.userId,
        groupId: input.groupId,
        op: "setAccountOperator",
        metadata: {
          operator,
          address: account.address,
          txHash,
        },
      });
    }

    return { account, operator, txHash };
  }

  async archiveAccount(input: {
    groupId: string;
    userId: string;
    bill?: boolean;
  }) {
    const account = await prisma.rewardAccount.findUnique({
      where: { groupId: input.groupId },
    });
    if (!account) throw new Error("No RewardAccount for this group.");
    if (account.status === "Archived") {
      return { account, already: true as const };
    }

    await blockchainService.archiveRewardAccount(account.accountKey as Hex);
    const updated = await prisma.rewardAccount.update({
      where: { id: account.id },
      data: { status: "Archived" },
    });
    await prisma.groupSettings.update({
      where: { groupId: input.groupId },
      data: { rewardEnabled: false, rewardPaused: true },
    });

    if (input.bill !== false) {
      await this.billConfigAction({
        userId: input.userId,
        groupId: input.groupId,
        op: "archive",
        metadata: { address: account.address },
      });
    }

    return { account: updated, already: false as const };
  }

  async readOnChainOperator(groupId: string): Promise<string | null> {
    const account = await prisma.rewardAccount.findUnique({ where: { groupId } });
    if (!account?.address) return null;
    try {
      return await blockchainService.rewardAccountOperator(
        account.address as Address,
      );
    } catch {
      return null;
    }
  }

  async setRewardConfig(
    groupId: string,
    data: {
      rewardEnabled?: boolean;
      rewardPaused?: boolean;
      rewardAmountPerPoint?: number;
      rewardCurrency?: PaymentCurrency;
      pointsPerCorrect?: number;
      pointsPerPoll?: number;
      pointsPerGame?: number;
      pointsPerSocial?: number;
    },
  ) {
    return prisma.groupSettings.update({
      where: { groupId },
      data: {
        rewardEnabled: data.rewardEnabled,
        rewardPaused: data.rewardPaused,
        rewardAmountPerPoint:
          data.rewardAmountPerPoint !== undefined
            ? data.rewardAmountPerPoint
            : undefined,
        rewardCurrency: data.rewardCurrency,
        pointsPerCorrect: data.pointsPerCorrect,
        pointsPerPoll: data.pointsPerPoll,
        pointsPerGame: data.pointsPerGame,
        pointsPerSocial: data.pointsPerSocial,
      },
    });
  }

  async getOrCreateMemberPoints(input: {
    groupId: string;
    telegramUserId: string;
    username?: string | null;
  }) {
    return prisma.memberPoints.upsert({
      where: {
        groupId_telegramUserId: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
      },
      update: {
        username: input.username ?? undefined,
      },
    });
  }

  async getOrCreateMemberRewardBalance(input: {
    groupId: string;
    telegramUserId: string;
    currency: PaymentCurrency;
  }) {
    return prisma.memberRewardBalance.upsert({
      where: {
        groupId_telegramUserId_currency: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
          currency: input.currency,
        },
      },
      create: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        currency: input.currency,
      },
      update: {},
    });
  }

  async listMemberPendingBalances(groupId: string, telegramUserId: string) {
    return prisma.memberRewardBalance.findMany({
      where: {
        groupId,
        telegramUserId,
        pendingReward: { gt: 0 },
      },
      orderBy: { currency: "asc" },
    });
  }

  /** Sum pending rewards for a group, in human units and wei per currency. */
  async sumPendingByCurrency(groupId: string): Promise<{
    human: Record<PaymentCurrency, number>;
    wei: {
      pendingCELO: bigint;
      pendingUSDm: bigint;
      pendingUSDC: bigint;
      pendingUSDT: bigint;
    };
  }> {
    const rows = await prisma.memberRewardBalance.groupBy({
      by: ["currency"],
      where: { groupId, pendingReward: { gt: 0 } },
      _sum: { pendingReward: true },
    });
    const human: Record<PaymentCurrency, number> = {
      CELO: 0,
      USDm: 0,
      USDC: 0,
      USDT: 0,
    };
    for (const row of rows) {
      if (!isPaymentCurrency(row.currency)) continue;
      human[row.currency] = decimalNumber(row._sum.pendingReward);
    }
    const toWei = (c: PaymentCurrency) =>
      parseUnits(human[c].toFixed(8), tokenDecimals(c));
    return {
      human,
      wei: {
        pendingCELO: toWei("CELO"),
        pendingUSDm: toWei("USDm"),
        pendingUSDC: toWei("USDC"),
        pendingUSDT: toWei("USDT"),
      },
    };
  }

  /**
   * Operator withdraws surplus above reserved member pendings to employer.
   */
  async withdrawSurplusToEmployer(groupId: string): Promise<{
    ok: boolean;
    message: string;
    txHash?: string;
  }> {
    const account = await prisma.rewardAccount.findUnique({ where: { groupId } });
    if (!account || account.status === "Archived") {
      return { ok: false, message: "No active RewardAccount for this group." };
    }
    const { wei, human } = await this.sumPendingByCurrency(groupId);
    try {
      const txHash = await blockchainService.withdrawRewardToEmployer({
        accountKey: account.accountKey as Hex,
        ...wei,
      });
      return {
        ok: true,
        message: `Withdrew surplus to employer (reserved pending CELO=${human.CELO} USDm=${human.USDm} USDC=${human.USDC} USDT=${human.USDT}). Tx: ${txHash}`,
        txHash,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Withdraw failed: ${reason.slice(0, 200)}` };
    }
  }

  async awardPoints(input: {
    groupId: string;
    telegramUserId: string;
    username?: string | null;
    points: number;
    reason?: string;
    activityId?: string;
    /** Explicit currency override (otherwise activity stamp → group default). */
    currency?: PaymentCurrency;
  }) {
    if (input.points <= 0) {
      return this.getOrCreateMemberPoints(input);
    }

    const member = await this.getOrCreateMemberPoints(input);
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });

    let currency: PaymentCurrency =
      input.currency ??
      (settings?.rewardCurrency && isPaymentCurrency(settings.rewardCurrency)
        ? settings.rewardCurrency
        : "USDm");
    let amountPerPoint = decimalNumber(settings?.rewardAmountPerPoint);

    if (input.activityId) {
      const activity = await prisma.engagementActivity.findUnique({
        where: { id: input.activityId },
      });
      if (activity) {
        if (isPaymentCurrency(activity.rewardCurrency)) {
          currency = activity.rewardCurrency;
        }
        if (activity.rewardAmountPerPoint != null) {
          amountPerPoint = decimalNumber(activity.rewardAmountPerPoint);
        }
      }
    }

    const cashDelta =
      settings?.rewardEnabled && !settings.rewardPaused && amountPerPoint > 0
        ? amountPerPoint * input.points
        : 0;

    const updated = await prisma.memberPoints.update({
      where: { id: member.id },
      data: {
        points: { increment: input.points },
        lifetimePoints: { increment: input.points },
        username: input.username ?? undefined,
      },
    });

    if (cashDelta > 0) {
      await this.getOrCreateMemberRewardBalance({
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        currency,
      });
      await prisma.memberRewardBalance.update({
        where: {
          groupId_telegramUserId_currency: {
            groupId: input.groupId,
            telegramUserId: input.telegramUserId,
            currency,
          },
        },
        data: { pendingReward: { increment: cashDelta } },
      });
    }

    await prisma.rewardLedger.create({
      data: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        kind: "award_points",
        status: "sent",
        pointsDelta: input.points,
        amount: cashDelta,
        currency,
        metaJson: JSON.stringify({
          reason: input.reason ?? null,
          activityId: input.activityId ?? null,
        }),
      },
    });

    if (cashDelta > 0) {
      await prisma.rewardLedger.create({
        data: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
          kind: "accumulate",
          status: "pending",
          pointsDelta: 0,
          amount: cashDelta,
          currency,
          metaJson: JSON.stringify({ fromPoints: input.points }),
        },
      });
    }

    return { ...updated, awardedCurrency: currency, cashDelta };
  }

  async resetPoints(groupId: string, telegramUserId: string) {
    const member = await this.getOrCreateMemberPoints({ groupId, telegramUserId });
    await prisma.memberPoints.update({
      where: { id: member.id },
      data: { points: 0 },
    });
    await prisma.rewardLedger.create({
      data: {
        groupId,
        telegramUserId,
        kind: "reset_points",
        status: "sent",
        pointsDelta: -member.points,
        amount: 0,
      },
    });
  }

  async updatePoints(
    groupId: string,
    telegramUserId: string,
    points: number,
    username?: string | null,
  ) {
    const member = await this.getOrCreateMemberPoints({
      groupId,
      telegramUserId,
      username,
    });
    const next = Math.max(0, Math.floor(points));
    const delta = next - member.points;
    await prisma.memberPoints.update({
      where: { id: member.id },
      data: { points: next },
    });
    await prisma.rewardLedger.create({
      data: {
        groupId,
        telegramUserId,
        kind: "update_points",
        status: "sent",
        pointsDelta: delta,
        amount: 0,
      },
    });
  }

  async setPayoutAddress(
    groupId: string,
    telegramUserId: string,
    address: string,
    username?: string | null,
  ) {
    if (!isAddress(address)) throw new Error("Invalid wallet address");
    return prisma.memberPoints.upsert({
      where: {
        groupId_telegramUserId: { groupId, telegramUserId },
      },
      create: {
        groupId,
        telegramUserId,
        username: username ?? null,
        payoutAddress: address,
      },
      update: { payoutAddress: address, username: username ?? undefined },
    });
  }

  /**
   * Attempt on-chain payout for pending cash in one currency.
   * Defaults to the largest pending balance (or `currency` override).
   */
  async tryPayoutMember(input: {
    groupId: string;
    telegramUserId: string;
    destination?: string;
    amountOverride?: number;
    currency?: PaymentCurrency;
  }): Promise<{
    ok: boolean;
    message: string;
    txHash?: string;
    amount?: number;
    currency?: string;
  }> {
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!settings?.rewardEnabled) {
      return { ok: false, message: "Cash rewards are disabled for this group." };
    }
    if (settings.rewardPaused) {
      return { ok: false, message: "Rewards are paused by the employer." };
    }

    const account = await prisma.rewardAccount.findUnique({
      where: { groupId: input.groupId },
    });
    if (!account || account.status === "Archived") {
      return {
        ok: false,
        message:
          "No reward account yet. Ask the employer to create one via Sentry.",
      };
    }
    if (account.status === "Paused") {
      return { ok: false, message: "Reward account is paused on-chain." };
    }

    const member = await this.getOrCreateMemberPoints({
      groupId: input.groupId,
      telegramUserId: input.telegramUserId,
    });
    const destination = (input.destination ?? member.payoutAddress ?? "").trim();
    if (!isAddress(destination)) {
      return {
        ok: false,
        message:
          "Send a valid 0x wallet address (tag Sentry) so I can pay your reward.",
      };
    }

    if (destination !== member.payoutAddress) {
      await this.setPayoutAddress(
        input.groupId,
        input.telegramUserId,
        destination,
      );
    }

    const balances = await this.listMemberPendingBalances(
      input.groupId,
      input.telegramUserId,
    );
    let target = balances.find(
      (b) => input.currency && b.currency === input.currency,
    );
    if (!target && !input.currency) {
      target = [...balances].sort(
        (a, b) => decimalNumber(b.pendingReward) - decimalNumber(a.pendingReward),
      )[0];
    }
    if (!target || !isPaymentCurrency(target.currency)) {
      return {
        ok: false,
        message: `No pending cash reward yet. You have ${member.points} points.`,
      };
    }

    const currency = target.currency;
    const pending = decimalNumber(target.pendingReward);
    const amount = input.amountOverride ?? pending;
    if (amount <= 0) {
      return {
        ok: false,
        message: `No pending ${currency} reward yet. You have ${member.points} points.`,
      };
    }
    if (amount > pending) {
      return {
        ok: false,
        message: `Only ${formatAmount(pending, currency)} pending in ${currency}.`,
      };
    }

    const payoutSeed = `payout:${input.groupId}:${input.telegramUserId}:${currency}:${Date.now()}:${randomBytes(8).toString("hex")}`;
    const payoutId = payoutIdHex(payoutSeed);
    const amountWei = parseUnits(amount.toFixed(8), tokenDecimals(currency));

    const ledger = await prisma.rewardLedger.create({
      data: {
        groupId: input.groupId,
        rewardAccountId: account.id,
        telegramUserId: input.telegramUserId,
        kind: "payout",
        status: "pending",
        pointsDelta: 0,
        amount,
        currency,
        payoutId,
        destination,
      },
    });

    try {
      const onChainBal = await blockchainService.rewardAccountBalance(
        account.address as Address,
        currency,
      );
      if (onChainBal < amountWei) {
        await prisma.rewardLedger.update({
          where: { id: ledger.id },
          data: {
            kind: "payout_failed",
            status: "failed",
            failureReason: "Insufficient reward account balance",
          },
        });
        return {
          ok: false,
          message: `Reward account needs more ${currency} (need ${formatAmount(amount, currency)}). Your balance stays pending — I'll pay when funded.`,
          amount,
          currency,
        };
      }

      const txHash = await blockchainService.payoutReward({
        accountKey: account.accountKey as Hex,
        to: destination as Address,
        amount: amountWei,
        payoutId,
        currency,
      });

      const remainingAfter = await prisma.memberRewardBalance.findMany({
        where: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
          pendingReward: { gt: 0 },
          NOT: { currency },
        },
      });
      const otherPending = remainingAfter.reduce(
        (s, r) => s + decimalNumber(r.pendingReward),
        0,
      );
      const thisRemaining = pending - amount;
      const clearPoints = otherPending <= 0 && thisRemaining <= 0;
      const pointsBefore = member.points;

      await prisma.$transaction([
        prisma.rewardLedger.update({
          where: { id: ledger.id },
          data: { status: "sent", txHash },
        }),
        prisma.memberRewardBalance.update({
          where: {
            groupId_telegramUserId_currency: {
              groupId: input.groupId,
              telegramUserId: input.telegramUserId,
              currency,
            },
          },
          data: {
            pendingReward: { decrement: amount },
            lifetimeRewarded: { increment: amount },
          },
        }),
        prisma.memberPoints.update({
          where: { id: member.id },
          data: {
            ...(clearPoints ? { points: 0 } : {}),
            payoutAddress: destination,
          },
        }),
        ...(clearPoints && pointsBefore > 0
          ? [
              prisma.rewardLedger.create({
                data: {
                  groupId: input.groupId,
                  rewardAccountId: account.id,
                  telegramUserId: input.telegramUserId,
                  kind: "reset_points",
                  status: "sent",
                  pointsDelta: -pointsBefore,
                  amount: 0,
                  currency,
                },
              }),
            ]
          : []),
      ]);

      return {
        ok: true,
        message: clearPoints
          ? `Sent ${formatAmount(amount, currency)} to ${destination}. Points reset to 0. Tx: ${txHash}`
          : `Sent ${formatAmount(amount, currency)} to ${destination}. Other currency pending remains. Tx: ${txHash}`,
        txHash,
        amount,
        currency,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await prisma.rewardLedger.update({
        where: { id: ledger.id },
        data: {
          kind: "payout_failed",
          status: "failed",
          failureReason: reason.slice(0, 500),
        },
      });
      console.error("[reward] payout failed", err);
      return {
        ok: false,
        message: `Payout failed (${reason.slice(0, 120)}). Your reward stays pending and will retry later.`,
        amount,
        currency,
      };
    }
  }

  /** Retry members with any per-currency pending and a known destination. */
  async retryPendingPayouts(limit = 25) {
    const balances = await prisma.memberRewardBalance.findMany({
      where: { pendingReward: { gt: 0 } },
      take: limit * 4,
      orderBy: { updatedAt: "asc" },
    });
    const seen = new Set<string>();
    let attempted = 0;
    let sent = 0;
    for (const b of balances) {
      const key = `${b.groupId}:${b.telegramUserId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (attempted >= limit) break;
      const member = await prisma.memberPoints.findUnique({
        where: {
          groupId_telegramUserId: {
            groupId: b.groupId,
            telegramUserId: b.telegramUserId,
          },
        },
      });
      if (!member?.payoutAddress) continue;
      const settings = await prisma.groupSettings.findUnique({
        where: { groupId: b.groupId },
      });
      if (!settings?.rewardEnabled || settings.rewardPaused) continue;
      attempted += 1;
      const result = await this.tryPayoutMember({
        groupId: b.groupId,
        telegramUserId: b.telegramUserId,
      });
      if (result.ok) sent += 1;
    }
    return { attempted, sent };
  }

  async leaderboard(groupId: string, limit = 10) {
    return prisma.memberPoints.findMany({
      where: { groupId },
      orderBy: { points: "desc" },
      take: limit,
    });
  }

  formatEngagementContext(settings: {
    allowGames?: boolean | null;
    allowPolls?: boolean | null;
    allowFun?: boolean | null;
    allowComics?: boolean | null;
    allowSocialCampaigns?: boolean | null;
    engagementGuidelines?: string | null;
    humorEnabled?: boolean | null;
    humorStyle?: string | null;
    rewardEnabled?: boolean | null;
    rewardPaused?: boolean | null;
    rewardAmountPerPoint?: { toString(): string } | number | null;
    rewardCurrency?: string | null;
    pointsPerCorrect?: number | null;
    pointsPerPoll?: number | null;
    pointsPerGame?: number | null;
    pointsPerSocial?: number | null;
  } | null) {
    if (!settings) return "(engagement settings not loaded)";
    const flags = [
      settings.allowFun && "fun",
      settings.allowGames && "games",
      settings.allowPolls && "polls",
      settings.allowComics && "comics",
      settings.allowSocialCampaigns && "social-campaigns",
    ].filter(Boolean);
    const reward =
      settings.rewardEnabled && !settings.rewardPaused
        ? `cash rewards ON (${decimalNumber(settings.rewardAmountPerPoint)} ${settings.rewardCurrency ?? "USDm"}/point); members withdraw by tagging Sentry with a 0x wallet`
        : settings.rewardEnabled && settings.rewardPaused
          ? "cash rewards PAUSED"
          : "cash rewards OFF (points only)";
    const humor =
      settings.humorEnabled === false || settings.humorStyle === "off"
        ? "humor OFF"
        : `humor ON (${settings.humorStyle ?? "friendly"})`;
    return [
      `Enabled engagement: ${flags.length ? flags.join(", ") : "none"}`,
      reward,
      humor,
      `Default points — correct:${settings.pointsPerCorrect ?? 10} poll:${settings.pointsPerPoll ?? 5} game:${settings.pointsPerGame ?? 15} social:${settings.pointsPerSocial ?? 20}`,
      settings.engagementGuidelines?.trim()
        ? `Employer engagement guidelines:\n${settings.engagementGuidelines.trim()}`
        : "Employer engagement guidelines: (none)",
    ].join("\n");
  }

  /** Deterministic hash helper for activity ids in meta. */
  hashPayload(payload: string) {
    return createHash("sha256").update(payload).digest("hex").slice(0, 16);
  }
}

export const rewardService = new RewardService();

/** Extract first 0x wallet from free text. */
export function extractWalletAddress(text: string): string | null {
  const m = text.match(/0x[a-fA-F0-9]{40}/);
  return m && isAddress(m[0]) ? m[0] : null;
}

/** True when member is asking to withdraw / claim reward. */
export function isRewardWithdrawRequest(text: string) {
  const t = text.toLowerCase();
  if (extractWalletAddress(text) && /\b(reward|withdraw|claim|payout|cash\s?out|send)\b/.test(t)) {
    return true;
  }
  return /\b(withdraw|claim|cash\s?out|send)\b.{0,40}\b(reward|points|prize)\b/.test(t)
    || /\b(reward|points|prize)\b.{0,40}\b(withdraw|claim|cash\s?out)\b/.test(t);
}
