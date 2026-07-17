import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const group = await groupService.getForUser(user.id, id);
    return NextResponse.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load group";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const body = await request.json();
    const settings = await groupService.updateSettings(user.id, id, body);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update group";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
