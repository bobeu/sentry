import { schedulerService } from "../services/scheduler.service";

schedulerService.start();
console.log("Scheduler running. Press Ctrl+C to stop.");

// Keep process alive
setInterval(() => undefined, 60_000);
