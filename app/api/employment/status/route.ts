import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const status = await employmentService.getStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
