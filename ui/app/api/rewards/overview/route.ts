import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import { rewardService } from "@/services/reward.service";
import { blockchainService } from "@/services/blockchain.service";
import { formatUnits, type Address } from "viem";
import { PAYMENT_CURRENCIES, tokenDecimals } from "@/lib/payment-currency";

export const dynamic = "force-dynamic";

/** Dashboard snapshot: reward accounts across the employer's groups. */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const groups = await groupService.listForUser(user.id);
    const factoryConfigured = blockchainService.isRewardFactoryConfigured();
    const factoryAddress = blockchainService.currentRewardFactoryAddress();

    const rows = await Promise.all(
      groups.map(async (g) => {
        // Soft-heal stale DB addresses after RewardFactory redeploy + sync-data.
        const account = factoryConfigured
          ? await rewardService.reconcileRewardAccountIfStale(g.id)
          : await rewardService.getAccount(g.id);

        let balances: Record<string, string> | null = null;
        let operator: string | null = null;
        if (account?.address && factoryConfigured) {
          try {
            const raw = await blockchainService.rewardAccountBalances(
              account.address as Address,
            );
            balances = {};
            for (const c of PAYMENT_CURRENCIES) {
              balances[c] = formatUnits(raw[c], tokenDecimals(c));
            }
          } catch {
            balances = null;
          }
          try {
            operator = await blockchainService.rewardAccountOperator(
              account.address as Address,
            );
          } catch {
            operator = null;
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
          operator,
          rewardEnabled: g.settings?.rewardEnabled ?? false,
          rewardPaused: g.settings?.rewardPaused ?? false,
          rewardAmountPerPoint: g.settings?.rewardAmountPerPoint?.toString() ?? "0",
          rewardCurrency: g.settings?.rewardCurrency ?? "USDm",
          balances,
          /** Legacy single balance field: prefer default campaign currency. */
          balance: balances?.[g.settings?.rewardCurrency ?? "USDm"] ?? null,
          factoryConfigured,
          factoryAddress,
        };
      }),
    );

    return NextResponse.json({
      groups: rows,
      factoryConfigured,
      factoryAddress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
