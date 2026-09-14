import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import { rewardService } from "@/services/reward.service";
import { isPaymentCurrency } from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";

type Params = { params: Promise<{ id: string }> };

/** GET reward account + leaderboard snapshot for a group. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    await groupService.getForUser(user.id, id);
    const account = await rewardService.reconcileRewardAccountIfStale(id);
    const leaderboard = await rewardService.leaderboard(id, 15);
    const operator = account
      ? await rewardService.readOnChainOperator(id)
      : null;
    return NextResponse.json({
      account,
      operator,
      leaderboard,
      factoryConfigured: blockchainService.isRewardFactoryConfigured(),
      factoryAddress: blockchainService.currentRewardFactoryAddress(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST create/ensure reward account, or pause/resume/setOperator/archive.
 * Body: { action?, currency?, operator? }
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    await groupService.getForUser(user.id, id);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      currency?: string;
      operator?: string;
    };
    const action = (body.action ?? "ensure").toLowerCase();

    if (action === "pause") {
      await rewardService.pauseRewards(id, true, user.id);
      return NextResponse.json({ ok: true, paused: true });
    }
    if (action === "resume") {
      await rewardService.resumeRewards(id, true, user.id);
      return NextResponse.json({ ok: true, paused: false });
    }
    if (action === "setoperator" || action === "set_account_operator") {
      if (!body.operator) {
        return NextResponse.json(
          { error: "operator address required" },
          { status: 400 },
        );
      }
      const result = await rewardService.setAccountOperator({
        groupId: id,
        userId: user.id,
        newOperator: body.operator,
      });
      return NextResponse.json({
        ok: true,
        operator: result.operator,
        txHash: result.txHash,
        account: result.account,
      });
    }
    if (action === "archive") {
      const result = await rewardService.archiveAccount({
        groupId: id,
        userId: user.id,
      });
      return NextResponse.json({ ok: true, account: result.account });
    }

    const currency =
      body.currency && isPaymentCurrency(body.currency)
        ? body.currency
        : undefined;

    if (!blockchainService.isRewardFactoryConfigured()) {
      return NextResponse.json(
        {
          error:
            "RewardFactory is not configured. Deploy on Celo and run smartContracts sync-data so ui/lib/contracts has the address and ABI.",
        },
        { status: 503 },
      );
    }

    const before = await rewardService.getAccount(id);
    const account = await rewardService.ensureRewardAccount({
      groupId: id,
      ownerUserId: user.id,
      currency,
      bill: !before || before.status === "Archived",
    });
    await rewardService.setRewardConfig(id, {
      rewardEnabled: true,
      rewardPaused: false,
      rewardCurrency: currency,
    });
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
