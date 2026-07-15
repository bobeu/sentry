import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";

export async function POST() {
  try {
    const user = await requireSessionUser();
    const result = await employmentService.start(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hire failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
