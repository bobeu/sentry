import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { playbookService } from "@/services/playbook.service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const groupId = new URL(request.url).searchParams.get("groupId");
    const rules = await playbookService.list(user.id, groupId);
    return NextResponse.json({ rules });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({
  trigger: z.string().min(1).max(300),
  instruction: z.string().min(1).max(1000),
  groupId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = createSchema.parse(await request.json());
    const rule = await playbookService.add({
      userId: user.id,
      trigger: body.trigger,
      instruction: body.instruction,
      groupId: body.groupId,
      source: "manual",
    });
    return NextResponse.json({ rule });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await playbookService.remove(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
