import cron from "node-cron";

export class SchedulerService {
  start() {
    cron.schedule("0 0 * * *", () => {
      console.log("[scheduler] daily summaries placeholder");
    });

    cron.schedule("5 0 * * *", () => {
      console.log("[scheduler] daily reports placeholder");
    });

    cron.schedule("0 9 * * *", () => {
      console.log("[scheduler] reminder jobs placeholder");
    });

    cron.schedule("30 0 * * *", () => {
      console.log("[scheduler] billing reconciliation placeholder");
    });

    cron.schedule("0 3 * * 0", () => {
      console.log("[scheduler] maintenance tasks placeholder");
    });
  }
}

export const schedulerService = new SchedulerService();
