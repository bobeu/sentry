import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";
import { isPaymentCurrency } from "@/lib/payment-currency";

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
    const result = await employmentService.start(user.id, user.email, currency);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hire failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
