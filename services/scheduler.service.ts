import cron from "node-cron";
import { contextService } from "@/services/context.service";
import { summaryService } from "@/services/summary.service";
import { prisma } from "@/lib/prisma";

export class SchedulerService {
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;

    // Conversation cleanup — every 15 minutes (24h retention)
    cron.schedule("*/15 * * * *", async () => {
      try {
        await contextService.pruneExpired();
        console.log("[scheduler] conversation cleanup done");
      } catch (err) {
        console.error("[scheduler] cleanup", err);
      }
    });

    // Daily summaries — check each hour which groups want this UTC hour
    cron.schedule("5 * * * *", async () => {
      const hour = new Date().getUTCHours();
      try {
        await summaryService.runHourlyPass(hour);
        console.log("[scheduler] daily summaries pass", hour);
      } catch (err) {
        console.error("[scheduler] summaries", err);
      }
    });

    // Daily reports — lightweight rollup at 00:10 UTC
    cron.schedule("10 0 * * *", async () => {
      try {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - 1);
        const count = await prisma.actionRecord.count({
          where: { completedAt: { gte: start }, status: "completed" },
        });
        console.log("[scheduler] daily report actions yesterday:", count);
      } catch (err) {
        console.error("[scheduler] reports", err);
      }
    });

    // Reminder notifications — 09:00 UTC nudge for paused employment with balance
    cron.schedule("0 9 * * *", async () => {
      try {
        const paused = await prisma.employment.findMany({
          where: { status: "Paused" },
          include: { user: { include: { settings: true, wallet: true } } },
        });
        console.log("[scheduler] reminder candidates:", paused.length);
      } catch (err) {
        console.error("[scheduler] reminders", err);
      }
    });

    // Maintenance — Sundays 03:00 UTC
    cron.schedule("0 3 * * 0", async () => {
      try {
        await contextService.pruneExpired();
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        await prisma.report.deleteMany({ where: { createdAt: { lt: cutoff } } });
        console.log("[scheduler] maintenance complete");
      } catch (err) {
        console.error("[scheduler] maintenance", err);
      }
    });

    console.log("[scheduler] started");
  }
}

export const schedulerService = new SchedulerService();
