import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import { z } from "zod";

const bodySchema = z.object({
  groupId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const { groupId } = bodySchema.parse(json);
    const result = await groupService.disable(user.id, groupId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Disable failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
