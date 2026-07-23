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
    const account = await rewardService.getAccount(id);
    const leaderboard = await rewardService.leaderboard(id, 15);
    return NextResponse.json({
      account,
      leaderboard,
      factoryConfigured: blockchainService.isRewardFactoryConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST create/ensure reward account, or pause/resume/config via action.
 * Body: { action?: "ensure"|"pause"|"resume", currency?: "USDm"|... }
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    await groupService.getForUser(user.id, id);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      currency?: string;
    };
    const action = (body.action ?? "ensure").toLowerCase();

    if (action === "pause") {
      await rewardService.pauseRewards(id);
      return NextResponse.json({ ok: true, paused: true });
    }
    if (action === "resume") {
      await rewardService.resumeRewards(id);
      return NextResponse.json({ ok: true, paused: false });
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

    const account = await rewardService.ensureRewardAccount({
      groupId: id,
      ownerUserId: user.id,
      currency,
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
