import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import { rewardService } from "@/services/reward.service";
import { blockchainService } from "@/services/blockchain.service";
import { formatUnits, type Address } from "viem";

export const dynamic = "force-dynamic";

/** Dashboard snapshot: reward accounts across the employer's groups. */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const groups = await groupService.listForUser(user.id);
    const factoryConfigured = blockchainService.isRewardFactoryConfigured();

    const rows = await Promise.all(
      groups.map(async (g) => {
        const account = await rewardService.getAccount(g.id);
        let balance: string | null = null;
        if (account?.address && factoryConfigured) {
          try {
            const raw = await blockchainService.rewardAccountBalance(
              account.address as Address,
            );
            balance = formatUnits(raw, 18);
          } catch {
            balance = null;
          }
        }
        return {
          groupId: g.id,
          groupName: g.name,
          telegramId: g.telegramId,
          account: account
            ? {
                id: account.id,
                address: account.address,
                currency: account.currency,
                status: account.status,
              }
            : null,
          rewardEnabled: g.settings?.rewardEnabled ?? false,
          rewardPaused: g.settings?.rewardPaused ?? false,
          rewardAmountPerPoint: g.settings?.rewardAmountPerPoint?.toString() ?? "0",
          rewardCurrency: g.settings?.rewardCurrency ?? "USDm",
          balance,
          factoryConfigured,
        };
      }),
    );

    return NextResponse.json({ groups: rows, factoryConfigured });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
