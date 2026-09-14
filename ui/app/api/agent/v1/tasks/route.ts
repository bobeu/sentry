import { NextResponse } from "next/server";
import { z } from "zod";
import { agentApiKeyService } from "@/services/playbook.service";
import { billingService } from "@/services/billing.service";
import { Errors, errorResponse } from "@/lib/errors";
import {
  EMPLOYEE_TASKS,
  employeeAgentService,
  type AgentUser,
} from "@/services/employee-agent.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  task: z.enum(EMPLOYEE_TASKS),
  telegramUserId: z.string().optional(),
  chatId: z.string().optional(),
  groupId: z.string().optional(),
  question: z.string().optional(),
  messageText: z.string().optional(),
  targetUserId: z.string().optional(),
  duration: z.string().optional(),
  moderationAction: z.enum(["ban", "unban", "mute", "unmute"]).optional(),
  engagementKind: z.enum(["poll", "trivia", "campaign", "fun"]).optional(),
  engagementEventKind: z
    .enum(["poll_answer", "quiz_callback", "cast_vote", "game_text"])
    .optional(),
  campaignUrl: z.string().optional(),
  memoryNote: z.string().optional(),
  callbackData: z.string().optional(),
  pollId: z.string().optional(),
  optionIds: z.array(z.number().int().nonnegative()).optional(),
  optionIndex: z.number().int().nonnegative().optional(),
  username: z.string().optional(),
  addressed: z.boolean().optional(),
  chatType: z.enum(["private", "group", "supergroup", "channel"]).optional(),
  botUsername: z.string().optional(),
  telegramMessageId: z.string().optional(),
});

const PRIVILEGED_NO_BALANCE = new Set([
  "askbot",
  "analytics_overview",
  "resolve_identity",
  "employer_callback",
  // Member vote / status reads must work even when employer wallet is empty.
  "engagement_event",
  "engagement_status",
  "log_group_message",
  "evaluate_group_reply",
]);

export async function POST(request: Request) {
  try {
    const user = (await agentApiKeyService.authenticate(
      request.headers.get("authorization"),
    )) as AgentUser | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = schema.parse(await request.json());

    if (!PRIVILEGED_NO_BALANCE.has(body.task)) {
      if (user.employment?.status !== "Active") {
        throw Errors.employmentInactive();
      }
      const ledger = await billingService.getBalanceLedger(user.id);
      if (ledger.availableBalance <= 0) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
      }
    }

    const outcome = await employeeAgentService.execute(user, body);
    await employeeAgentService.recordBillable(user.id, outcome, body.task);

    return NextResponse.json({ ok: true, task: body.task, result: outcome.result });
  } catch (err) {
    const mapped = errorResponse(err);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }
}
