import { createHash, randomBytes } from "crypto";
import {
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
  type PaymentCurrency,
} from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";

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
   * Ensure a RewardAccount exists for the group (on-chain + DB).
   * Employer manages via Sentry; only the operator key can payout.
   */
  async ensureRewardAccount(input: {
    groupId: string;
    ownerUserId: string;
    currency?: PaymentCurrency;
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

    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    const currencyRaw =
      input.currency ??
      (settings?.rewardCurrency && isPaymentCurrency(settings.rewardCurrency)
        ? settings.rewardCurrency
        : "USDm");
    const currency = currencyRaw as PaymentCurrency;
    const accountKey = accountKeyForGroup(group.telegramId);

    const address = await blockchainService.ensureRewardAccount({
      accountKey,
      currency,
    });

    const row = await prisma.rewardAccount.upsert({
      where: { groupId: input.groupId },
      create: {
        groupId: input.groupId,
        ownerUserId: input.ownerUserId,
        address,
        accountKey,
        currency,
        status: "Active",
      },
      update: {
        address,
        accountKey,
        currency,
        status: "Active",
        ownerUserId: input.ownerUserId,
      },
    });

    return row;
  }

  async getAccount(groupId: string) {
    return prisma.rewardAccount.findUnique({ where: { groupId } });
  }

  async pauseRewards(groupId: string, viaOnChain = true) {
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
  }

  async resumeRewards(groupId: string, viaOnChain = true) {
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

  async awardPoints(input: {
    groupId: string;
    telegramUserId: string;
    username?: string | null;
    points: number;
    reason?: string;
    activityId?: string;
  }) {
    if (input.points <= 0) {
      return this.getOrCreateMemberPoints(input);
    }

    const member = await this.getOrCreateMemberPoints(input);
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    const amountPerPoint = decimalNumber(settings?.rewardAmountPerPoint);
    const cashDelta =
      settings?.rewardEnabled && !settings.rewardPaused && amountPerPoint > 0
        ? amountPerPoint * input.points
        : 0;

    const updated = await prisma.memberPoints.update({
      where: { id: member.id },
      data: {
        points: { increment: input.points },
        lifetimePoints: { increment: input.points },
        pendingReward: cashDelta > 0 ? { increment: cashDelta } : undefined,
        username: input.username ?? undefined,
      },
    });

    await prisma.rewardLedger.create({
      data: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        kind: "award_points",
        status: "sent",
        pointsDelta: input.points,
        amount: cashDelta,
        currency: settings?.rewardCurrency ?? "USDm",
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
          currency: settings?.rewardCurrency ?? "USDm",
          metaJson: JSON.stringify({ fromPoints: input.points }),
        },
      });
    }

    return updated;
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
   * Attempt on-chain payout for pending cash. On failure, keep pending for retry.
   */
  async tryPayoutMember(input: {
    groupId: string;
    telegramUserId: string;
    destination?: string;
    amountOverride?: number;
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

    const pending = decimalNumber(member.pendingReward);
    const amount = input.amountOverride ?? pending;
    if (amount <= 0) {
      return {
        ok: false,
        message: `No pending cash reward yet. You have ${member.points} points.`,
      };
    }

    const currency = (isPaymentCurrency(account.currency)
      ? account.currency
      : "USDm") as PaymentCurrency;
    const payoutSeed = `payout:${input.groupId}:${input.telegramUserId}:${Date.now()}:${randomBytes(8).toString("hex")}`;
    const payoutId = payoutIdHex(payoutSeed);
    const amountWei = parseUnits(amount.toFixed(8), currency === "USDC" || currency === "USDT" ? 6 : 18);

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
      const balance = await blockchainService.rewardAccountBalance(
        account.address as Address,
      );
      if (balance < amountWei) {
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
          message: `Reward account needs more funds (need ${formatAmount(amount, currency)}). Your ${formatAmount(amount, currency)} stays pending — I'll pay when funded.`,
          amount,
          currency,
        };
      }

      const txHash = await blockchainService.payoutReward({
        accountAddress: account.address as Address,
        to: destination as Address,
        amount: amountWei,
        payoutId,
      });

      await prisma.$transaction([
        prisma.rewardLedger.update({
          where: { id: ledger.id },
          data: { status: "sent", txHash },
        }),
        prisma.memberPoints.update({
          where: { id: member.id },
          data: {
            pendingReward: { decrement: amount },
            lifetimeRewarded: { increment: amount },
            payoutAddress: destination,
          },
        }),
      ]);

      return {
        ok: true,
        message: `Sent ${formatAmount(amount, currency)} to ${destination}. Tx: ${txHash}`,
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

  /** Retry failed/pending accumulate payouts that have a known destination. */
  async retryPendingPayouts(limit = 25) {
    const members = await prisma.memberPoints.findMany({
      where: {
        pendingReward: { gt: 0 },
        payoutAddress: { not: null },
      },
      take: limit,
      orderBy: { updatedAt: "asc" },
    });

    let sent = 0;
    for (const m of members) {
      const settings = await prisma.groupSettings.findUnique({
        where: { groupId: m.groupId },
      });
      if (!settings?.rewardEnabled || settings.rewardPaused) continue;
      const result = await this.tryPayoutMember({
        groupId: m.groupId,
        telegramUserId: m.telegramUserId,
      });
      if (result.ok) sent += 1;
    }
    return { attempted: members.length, sent };
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
