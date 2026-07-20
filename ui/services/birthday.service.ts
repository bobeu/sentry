import { prisma } from "@/lib/prisma";
import { getBot } from "@/services/telegram.service";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";

export class BirthdayService {
  async set(input: {
    groupId: string;
    telegramUserId: string;
    month: number;
    day: number;
    displayName?: string | null;
  }) {
    if (input.month < 1 || input.month > 12 || input.day < 1 || input.day > 31) {
      throw new Error("Invalid date. Use MM-DD (e.g. 07-20).");
    }
    return prisma.memberBirthday.upsert({
      where: {
        groupId_telegramUserId: {
          groupId: input.groupId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        groupId: input.groupId,
        telegramUserId: input.telegramUserId,
        month: input.month,
        day: input.day,
        displayName: input.displayName ?? null,
      },
      update: {
        month: input.month,
        day: input.day,
        displayName: input.displayName ?? null,
        consentAt: new Date(),
      },
    });
  }

  async clear(groupId: string, telegramUserId: string) {
    await prisma.memberBirthday.deleteMany({
      where: { groupId, telegramUserId },
    });
  }

  async runHourlyPass(hourUtc: number) {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const year = now.getUTCFullYear();

    const settings = await prisma.groupSettings.findMany({
      where: {
        enabled: true,
        birthdaysEnabled: true,
        birthdayHourUtc: hourUtc,
      },
      include: {
        group: {
          include: {
            employment: {
              where: { enabled: true },
              include: { user: { include: { employment: true, wallet: true } } },
            },
          },
        },
      },
    });

    const bot = getBot();
    for (const s of settings) {
      const birthdays = await prisma.memberBirthday.findMany({
        where: {
          groupId: s.groupId,
          month,
          day,
          OR: [{ lastCelebratedYear: null }, { lastCelebratedYear: { not: year } }],
        },
      });
      if (birthdays.length === 0) continue;

      let employerUserId: string | null = null;
      let billable = false;
      for (const link of s.group.employment) {
        if (link.user.employment?.status !== "Active" || !link.user.wallet) continue;
        employerUserId = link.userId;
        try {
          const ledger = await billingService.getBalanceLedger(link.userId);
          if (ledger.availableBalance > 0) {
            billable = true;
            break;
          }
        } catch {
          // keep employer id
        }
      }

      for (const b of birthdays) {
        const name = b.displayName || "friend";
        const text = `Happy birthday, ${name}! 🎉 The community is glad you're here.`;
        try {
          await bot.telegram.sendMessage(Number(s.group.telegramId), text);
          await prisma.memberBirthday.update({
            where: { id: b.id },
            data: { lastCelebratedYear: year },
          });
          if (employerUserId) {
            await actionService.record({
              type: "birthday",
              groupId: s.groupId,
              userId: employerUserId,
              billable,
              metadata: {
                telegramUserId: b.telegramUserId,
                month,
                day,
              },
            });
          }
        } catch (err) {
          console.warn("[birthday]", err);
        }
      }
    }
  }
}

export const birthdayService = new BirthdayService();
