import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";
import { errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const config = await walletService.getDepositConfig(user.id);
    return NextResponse.json(config);
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
