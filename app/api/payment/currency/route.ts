import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { paymentService } from "@/services/payment.service";
import { isPaymentCurrency } from "@/lib/payment-currency";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";

const bodySchema = z.object({
  currency: z.string(),
  enabled: z.boolean().optional(),
  tokenAddress: z.string().nullable().optional(),
});

export async function GET() {
  const config = await paymentService.getPublicConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const json = await request.json();
    const { currency, enabled, tokenAddress } = bodySchema.parse(json);
    if (!isPaymentCurrency(currency)) {
      return NextResponse.json({ error: "Invalid payment currency" }, { status: 400 });
    }
    const result = await paymentService.configureCurrency({
      currency,
      enabled,
      tokenAddress,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
