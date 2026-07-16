import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";
import { z } from "zod";

const bodySchema = z.object({
  amount: z.number().positive(),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    return NextResponse.json({
      withdrawals: await walletService.getWithdrawalHistory(user.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawals failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const { amount } = bodySchema.parse(json);
    const result = await walletService.recordWithdraw(user.id, amount);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdraw failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
