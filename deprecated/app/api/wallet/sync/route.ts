import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { syncService } from "@/services/sync.service";
import { errorResponse } from "@/lib/errors";

export async function POST() {
  try {
    const user = await requireSessionUser();
    const synced = await syncService.syncUser(user.id);
    if (!synced) {
      return NextResponse.json({ error: "Wallet not found. Hire Sentry first." }, { status: 400 });
    }
    return NextResponse.json({
      address: synced.address,
      balance: synced.balance,
      currency: synced.currency,
    });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
