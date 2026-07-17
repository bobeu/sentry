import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { billingService } from "@/services/billing.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const history = await billingService.getHistory(user.id);
    return NextResponse.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "History failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
