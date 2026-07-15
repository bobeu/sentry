import { NextResponse } from "next/server";
import { billingService } from "@/services/billing.service";

export async function GET() {
  return NextResponse.json({
    currency: "cUSD",
    pricing: billingService.getPricing(),
  });
}
