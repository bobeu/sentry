import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";
import { errorResponse } from "@/lib/errors";

/** Sync balance from blockchain (Method B — after direct transfer). */
export async function POST() {
  try {
    const user = await requireSessionUser();
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) {
      return NextResponse.json({ error: "No wallet found. Hire Sentry first." }, { status: 400 });
    }

    const previous = Number(wallet.balance.toString());
    const synced = await walletService.handleDepositDetected(user.id, previous);
    if (!synced) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    return NextResponse.json({
      address: synced.address,
      balance: synced.balance,
      currency: synced.currency,
    });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
