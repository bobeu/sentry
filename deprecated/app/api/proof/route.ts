import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { proofService } from "@/services/proof.service";
import { escalationService } from "@/services/escalation.service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const [proof, escalations, incidents, handovers] = await Promise.all([
      proofService.buildWeekly(user.id),
      escalationService.listPending(user.id),
      prisma.incidentEvent.findMany({
        where: {
          status: { in: ["open", "monitoring"] },
          group: { employment: { some: { userId: user.id, enabled: true } } },
        },
        include: { group: { select: { id: true, name: true, telegramId: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.report.findMany({
        where: { userId: user.id, kind: "shift" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { group: { select: { name: true, telegramId: true } } },
      }),
    ]);

    return NextResponse.json({
      proof,
      escalations,
      incidents,
      handovers,
    });
  } catch (err) {
    const { message, status } = errorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
