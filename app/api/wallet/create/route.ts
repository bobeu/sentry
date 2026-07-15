import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";

/** Ensures the employment smart wallet exists. Never returns private keys. */
export async function POST() {
  try {
    const user = await requireSessionUser();
    const wallet = await walletService.ensureSmartWallet(user.id);
    return NextResponse.json({ wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
