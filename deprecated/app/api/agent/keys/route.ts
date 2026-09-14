import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { agentApiKeyService } from "@/services/playbook.service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const keys = await agentApiKeyService.list(user.id);
    return NextResponse.json({ keys });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({
  label: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const created = await agentApiKeyService.create(user.id, body.label ?? "default");
    return NextResponse.json(created);
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
    await agentApiKeyService.revoke(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
