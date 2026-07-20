import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import { announcementService } from "@/services/announcement.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const postSchema = z.object({
  groupId: z.string().min(1),
  text: z.string().min(1).max(4000),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const body = postSchema.parse(json);
    const group = await groupService.getForUser(user.id, body.groupId);

    if (group.settings?.announcementsEnabled === false) {
      return NextResponse.json(
        { error: "Announcements disabled for this group" },
        { status: 400 },
      );
    }

    if (body.scheduledAt) {
      const row = await announcementService.schedule({
        groupId: body.groupId,
        userId: user.id,
        text: body.text,
        scheduledAt: new Date(body.scheduledAt),
      });
      return NextResponse.json({ announcement: row });
    }

    const employment = await prisma.groupEmployment.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: body.groupId } },
    });
    let billable = false;
    try {
      const { billingService } = await import("@/services/billing.service");
      const ledger = await billingService.getBalanceLedger(user.id);
      billable = ledger.availableBalance > 0;
    } catch {
      billable = false;
    }

    const row = await announcementService.postNow({
      groupId: body.groupId,
      telegramChatId: group.telegramId,
      text: body.text,
      userId: user.id,
      billable: Boolean(employment?.enabled) && billable,
      personaRole: group.settings?.personaRole,
    });
    return NextResponse.json({ announcement: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Announce failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
