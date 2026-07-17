import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { walletService } from "@/services/wallet.service";
import { isPaymentCurrency } from "@/lib/payment-currency";

/** Ensures the employment smart wallet exists. Never returns private keys. */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json().catch(() => ({}));
    if (body.currency !== undefined && !isPaymentCurrency(body.currency)) {
      throw new Error("Invalid payment currency");
    }
    const currency =
      typeof body.currency === "string" && isPaymentCurrency(body.currency)
        ? body.currency
        : undefined;
    const wallet = await walletService.ensureSmartWallet(user.id, user.email, currency);
    return NextResponse.json({ wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
