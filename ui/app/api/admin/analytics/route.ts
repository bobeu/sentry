import { NextResponse } from "next/server";
import { requireGrandAdmin } from "@/lib/owner";
import { analyticsService } from "@/services/analytics.service";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGrandAdmin();
    const overview = await analyticsService.overview();
    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    const mapped = errorResponse(err);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }
}
