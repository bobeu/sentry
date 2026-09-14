import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";

export class MemoryService {
  async remember(input: {
    groupId: string;
    telegramUserId: string;
    note: string;
    employerUserId?: string | null;
    billable?: boolean;
  }) {
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!settings?.memberMemoryEnabled) {
      throw new Error("Member memory is disabled for this group.");
    }

    const row = await prisma.memberMemory.upsert({
      where: {
        groupId_telegramUserId: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        note: input.note.trim().slice(0, 1000),
        consentAt: new Date(),
      },
      update: {
        note: input.note.trim().slice(0, 1000),
        consentAt: new Date(),
      },
    });

    if (input.employerUserId) {
      await actionService.record({
        type: "member_memory",
        groupId: input.groupId,
        userId: input.employerUserId,
        billable: Boolean(input.billable),
        metadata: { telegramUserId: input.telegramUserId },
      });
    }

    return row;
  }

  async forget(groupId: string, telegramUserId: string) {
    await prisma.memberMemory.deleteMany({ where: { groupId, telegramUserId } });
    return { ok: true };
  }

  async getNote(groupId: string, telegramUserId: string | null) {
    if (!telegramUserId) return null;
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId },
    });
    if (!settings?.memberMemoryEnabled) return null;
    const row = await prisma.memberMemory.findUnique({
      where: {
        groupId_telegramUserId: { groupId, telegramUserId },
      },
    });
    return row?.note ?? null;
  }
}

export const memoryService = new MemoryService();
