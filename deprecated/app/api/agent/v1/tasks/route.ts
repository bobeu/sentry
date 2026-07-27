import { NextResponse } from "next/server";
import { z } from "zod";
import { agentApiKeyService } from "@/services/playbook.service";
import { contextService } from "@/services/context.service";
import { aiService } from "@/services/ai.service";
import { faqService } from "@/services/faq.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { prisma } from "@/lib/prisma";
import { Errors, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  task: z.enum(["summarize_thread", "answer_faq", "status"]),
  groupId: z.string().optional(),
  question: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await agentApiKeyService.authenticate(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.employment?.status !== "Active") {
      throw Errors.employmentInactive();
    }

    const ledger = await billingService.getBalanceLedger(user.id);
    if (ledger.availableBalance <= 0) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
    }

    const body = schema.parse(await request.json());
    let result: unknown;

    if (body.task === "status") {
      const groups = await prisma.groupEmployment.count({
        where: { userId: user.id, enabled: true },
      });
      result = {
        employment: user.employment.status,
        enabledGroups: groups,
        availableBalance: ledger.availableBalance,
        currency: ledger.currency,
      };
    } else if (body.task === "summarize_thread") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId required" }, { status: 400 });
      }
      const link = await prisma.groupEmployment.findUnique({
        where: { userId_groupId: { userId: user.id, groupId: body.groupId } },
      });
      if (!link) throw Errors.groupNotFound();
      const context = await contextService.build(body.groupId);
      const summary = await aiService.generateDailySummary(context);
      result = { summary };
    } else {
      if (!body.groupId || !body.question) {
        return NextResponse.json(
          { error: "groupId and question required" },
          { status: 400 },
        );
      }
      const faqs = await faqService.list(body.groupId);
      const hit = faqService.match(faqs, body.question);
      const context = await contextService.build(body.groupId);
      const reply = await aiService.generateReply({
        context,
        userQuestion: body.question,
        preferFaq: false,
        groupId: body.groupId,
      });
      result = {
        answer: reply.text,
        viaFaq: reply.viaFaq || Boolean(hit),
      };
    }

    await actionService.record({
      type: "agent_task",
      userId: user.id,
      groupId: body.groupId ?? null,
      billable: true,
      metadata: { task: body.task },
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const mapped = errorResponse(err);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }
}
