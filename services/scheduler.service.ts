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

    // Daily summaries — once per group at its configured UTC hour (tick each hour, only matching groups)
    cron.schedule("5 * * * *", async () => {
      const hour = new Date().getUTCHours();
      try {
        await summaryService.runHourlyPass(hour);
        console.log("[scheduler] daily summaries for hour", hour);
      } catch (err) {
        console.error("[scheduler] summaries", err);
      }
    });

    // Reminder jobs — every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
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

    // Maintenance — once weekly (Sunday 03:00 UTC)
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

    // Blockchain balance sync + settlement evaluation — every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        const { syncService } = await import("@/services/sync.service");
        const { billingService } = await import("@/services/billing.service");
        const result = await syncService.syncAllWallets();
        const settlements = await billingService.evaluateSettlements();
        console.log("[scheduler] wallet sync", result, "settlements", settlements);
      } catch (err) {
        console.error("[scheduler] wallet sync", err);
      }
    });

    console.log("[scheduler] started");
  }
}

export const schedulerService = new SchedulerService();
