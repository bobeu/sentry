import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const balance = await walletService.getBalance(user.id);
    return NextResponse.json(balance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Balance failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
