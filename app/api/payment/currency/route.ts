import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { paymentService } from "@/services/payment.service";
import { isPaymentCurrency } from "@/lib/payment-currency";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";

const bodySchema = z.object({
  currency: z.string(),
});

export async function GET() {
  const config = await paymentService.getPublicConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const json = await request.json();
    const { currency } = bodySchema.parse(json);
    if (!isPaymentCurrency(currency)) {
      return NextResponse.json({ error: "Invalid payment currency" }, { status: 400 });
    }
    const result = await paymentService.setActiveCurrency(currency);
    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
