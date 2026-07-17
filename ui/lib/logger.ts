type LogLevel = "info" | "warn" | "error";

const IMPORTANT = new Set([
  "Employment Started",
  "Employment Paused",
  "Employment Resumed",
  "Employment Exhausted",
  "Charge Completed",
  "Charge Failed",
  "Charge Pending",
  "Bot Joined Group",
  "Bot Removed",
  "Bot Permission Lost",
  "Summary Generated",
  "Deposit Detected",
  "Withdrawal Completed",
  "Payment Currency Updated",
  "Low Balance",
]);

export function logEvent(event: string, detail?: Record<string, unknown>) {
  if (!IMPORTANT.has(event)) return;
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`[sentry] ${event}${payload}`);
}

export function logWarn(event: string, detail?: Record<string, unknown>) {
  logLevel("warn", event, detail);
}

export function logError(event: string, detail?: Record<string, unknown>) {
  logLevel("error", event, detail);
}

function logLevel(level: LogLevel, event: string, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  const line = `[sentry] ${event}${payload}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
