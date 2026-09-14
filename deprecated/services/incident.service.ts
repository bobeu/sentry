import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { getBot } from "@/services/telegram.service";

const INCIDENT =
  /\b(hack(ed|ing)?|exploit(ed|ation)?|rug(\s*pull)?|drained|outage|down|breach|compromised|emergency|incident)\b/i;

export function looksLikeIncident(text: string) {
  return INCIDENT.test(text);
}

export class IncidentService {
  async maybeTrigger(input: {
    groupId: string;
    telegramChatId: string;
    text: string;
    fromUsername: string | null;
    employerUserId: string | null;
    billable: boolean;
    botCanDelete?: boolean | null;
    adminTelegramIds: string[];
    groupName?: string | null;
  }) {
    if (!looksLikeIncident(input.text)) return null;

    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!settings?.incidentMode) return null;

    const open = await prisma.incidentEvent.findFirst({
      where: {
        groupId: input.groupId,
        status: { in: ["open", "monitoring"] },
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
    });
    if (open) return open;

    const calm =
      "⚠️ Incident notice: please avoid sharing seed phrases or clicking unfamiliar links. Admins are reviewing — official updates will be posted here.";

    const event = await prisma.incidentEvent.create({
      data: {
        groupId: input.groupId,
        trigger: input.text.slice(0, 280),
        status: "open",
        timeline: [
          {
            at: new Date().toISOString(),
            from: input.fromUsername,
            text: input.text.slice(0, 280),
          },
        ],
      },
    });

    const bot = getBot();
    await bot.telegram
      .sendMessage(Number(input.telegramChatId), calm)
      .catch(() => undefined);

    for (const adminId of input.adminTelegramIds.slice(0, 5)) {
      await bot.telegram
        .sendMessage(
          Number(adminId),
          `Incident mode — ${input.groupName ?? input.telegramChatId}\nTrigger: ${input.text.slice(0, 300)}`,
        )
        .catch(() => undefined);
    }

    if (input.employerUserId) {
      await actionService.record({
        type: "incident_mode",
        groupId: input.groupId,
        userId: input.employerUserId,
        billable: input.billable,
        metadata: { incidentId: event.id },
      });
    }

    return event;
  }
}

export const incidentService = new IncidentService();
