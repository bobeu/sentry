import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { billingService } from "@/services/billing.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const spending = await billingService.getSpending(user.id);
    return NextResponse.json(spending);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spending failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
