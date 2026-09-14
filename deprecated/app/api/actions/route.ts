import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { actionService } from "@/services/action.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const actions = await actionService.listForUser(user.id, 100);
    return NextResponse.json({ actions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
