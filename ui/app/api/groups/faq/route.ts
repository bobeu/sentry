import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { faqService } from "@/services/faq.service";
import { groupService } from "@/services/group.service";
import { z } from "zod";

const createSchema = z.object({
  groupId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
});

const deleteSchema = z.object({
  groupId: z.string().min(1),
  faqId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const { groupId, question, answer } = createSchema.parse(json);
    await groupService.getForUser(user.id, groupId);
    const faq = await faqService.add(groupId, question, answer);
    return NextResponse.json({ faq });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FAQ create failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const { groupId, faqId } = deleteSchema.parse(json);
    await groupService.getForUser(user.id, groupId);
    await faqService.remove(groupId, faqId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FAQ delete failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
