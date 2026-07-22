import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";
import { isPaymentCurrency } from "@/lib/payment-currency";
import { z } from "zod";

const bodySchema = z.object({
  currency: z.string().optional(),
  agreementAccepted: z.boolean(),
  agreementVersion: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    if (!body.agreementAccepted) {
      return NextResponse.json(
        {
          error:
            "Employment Agreement was not accepted. Hire cancelled — no action taken.",
        },
        { status: 400 },
      );
    }

    if (body.currency !== undefined && !isPaymentCurrency(body.currency)) {
      throw new Error("Invalid payment currency");
    }
    const currency =
      typeof body.currency === "string" && isPaymentCurrency(body.currency)
        ? body.currency
        : undefined;

    const result = await employmentService.start(user.id, user.email, currency, {
      agreementAccepted: true,
      agreementVersion: body.agreementVersion,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hire failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
