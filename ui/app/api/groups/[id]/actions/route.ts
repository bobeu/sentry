import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { actionService } from "@/services/action.service";
import { groupService } from "@/services/group.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    await groupService.getForUser(user.id, id);
    const actions = await actionService.listForGroup(id, 100);
    return NextResponse.json({ actions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
