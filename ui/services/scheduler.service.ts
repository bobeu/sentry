import cron from "node-cron";
import { contextService } from "@/services/context.service";
import { summaryService } from "@/services/summary.service";
import { prisma } from "@/lib/prisma";

export class SchedulerService {
  private started = false;
  private databaseUnavailable = false;

  private async runJob(name: string, work: () => Promise<void>) {
    try {
      await work();
      if (this.databaseUnavailable) {
        console.info("[scheduler] database connection restored");
        this.databaseUnavailable = false;
      }
    } catch (error) {
      if (!this.databaseUnavailable) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[scheduler] ${name} skipped: database or dependency is unavailable. The application will stay online and retry on the next run.`,
          message,
        );
        this.databaseUnavailable = true;
      }
    }
  }

  start() {
    if (this.started) return;
    this.started = true;

    cron.schedule("*/15 * * * *", async () => {
      await this.runJob("conversation cleanup", async () => {
        await contextService.pruneExpired();
        console.log("[scheduler] conversation cleanup done");
      });
    });

    cron.schedule("5 * * * *", async () => {
      const hour = new Date().getUTCHours();
      await this.runJob("daily summaries", async () => {
        await summaryService.runHourlyPass(hour);
        console.log("[scheduler] daily summaries for hour", hour);
      });
    });

    cron.schedule("*/15 * * * *", async () => {
      await this.runJob("employment reminders", async () => {
        const paused = await prisma.employment.findMany({
          where: { status: "Paused" },
          include: { user: { include: { settings: true, wallet: true } } },
        });
        console.log("[scheduler] reminder candidates:", paused.length);
      });
    });

    cron.schedule("0 3 * * 0", async () => {
      await this.runJob("maintenance", async () => {
        await contextService.pruneExpired();
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        await prisma.report.deleteMany({ where: { createdAt: { lt: cutoff } } });
        console.log("[scheduler] maintenance complete");
      });
    });

    cron.schedule("0 16 * * 0", async () => {
      await this.runJob("weekly proof-of-work", async () => {
        const { proofService } = await import("@/services/proof.service");
        await proofService.runWeeklyPass();
        console.log("[scheduler] weekly proof-of-work done");
      });
    });

    cron.schedule("*/5 * * * *", async () => {
      await this.runJob("wallet sync", async () => {
        const { syncService } = await import("@/services/sync.service");
        const { billingService } = await import("@/services/billing.service");
        const result = await syncService.syncAllWallets();
        const settlements = await billingService.evaluateSettlements();
        console.log("[scheduler] wallet sync", result, "settlements", settlements);
      });
    });

    console.log("[scheduler] started");
  }
}

export const schedulerService = new SchedulerService();
