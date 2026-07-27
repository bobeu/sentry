export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { schedulerService } = await import("@/services/scheduler.service");
      schedulerService.start();
    } catch (error) {
      console.warn(
        "[instrumentation] Scheduler could not start; the web application remains available.",
        error,
      );
    }
  }
}
