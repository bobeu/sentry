import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { employmentService } from "@/services/employment.service";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const agreement = await employmentService.getAgreement(user.id);
    return NextResponse.json(agreement);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

const decisionSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  version: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = decisionSchema.parse(await request.json());
    if (body.decision === "reject") {
      const result = await employmentService.rejectAgreement(user.id);
      return NextResponse.json(result);
    }
    const result = await employmentService.acceptAgreement(user.id, body.version);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
