import { NextResponse } from "next/server";
import { billingService } from "@/services/billing.service";

export async function GET() {
  const pricing = await billingService.getPricing();
  const currency = pricing[0]?.currency ?? "USDm";
  return NextResponse.json({ currency, pricing });
}
