import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const groups = await groupService.listForUser(user.id);
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list groups";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
