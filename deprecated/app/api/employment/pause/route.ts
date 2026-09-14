import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";

export async function POST() {
  try {
    const user = await requireSessionUser();
    const employment = await employmentService.pause(user.id);
    return NextResponse.json({ employment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pause failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
