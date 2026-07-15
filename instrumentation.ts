export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { schedulerService } = await import("@/services/scheduler.service");
    schedulerService.start();
  }
}
