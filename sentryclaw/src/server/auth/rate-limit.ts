import { logInfo, logWarn } from "@/server/log";

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Keyed by a caller identifier (e.g. IP or deterministic test key).
 * Each key tracks a sliding window of attempt timestamps.  When the
 * window fills beyond `maxAttempts`, subsequent calls are blocked
 * until old entries expire.
 *
 * Not shared across Vercel function instances — that is acceptable
 * for login brute-force protection because each cold-start gets a
 * fresh window, and the main goal is to slow automated attacks
 * hitting the same instance.
 */

type RateLimitEntry = {
  /** Timestamps (ms) of recent attempts within the window. */
  timestamps: number[];
};

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 10;

let store = new Map<string, RateLimitEntry>();

export type RateLimitConfig = {
  windowMs?: number;
  maxAttempts?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
};

/**
 * Check whether a caller key is within the rate limit.
 *
 * Each call is recorded as an attempt. Returns whether the caller
 * is allowed to proceed and how many attempts remain.
 */
export function checkRateLimit(
  callerKey: string,
  config?: RateLimitConfig,
): RateLimitResult {
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(callerKey);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(callerKey, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxAttempts) {
    const oldestInWindow = entry.timestamps[0]!;
    const retryAfterMs = oldestInWindow + windowMs - now;
    logWarn("auth.rate_limit.blocked", {
      callerKey,
      attempts: entry.timestamps.length,
      retryAfterMs,
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  entry.timestamps.push(now);
  const remaining = maxAttempts - entry.timestamps.length;

  if (remaining <= 3) {
    logInfo("auth.rate_limit.warning", {
      callerKey,
      remaining,
      attempts: entry.timestamps.length,
    });
  }

  return { allowed: true, remaining, retryAfterMs: null };
}

/**
 * Extract a caller key from a request for rate limiting.
 *
 * Uses X-Forwarded-For (first entry), X-Real-IP, or falls back
 * to a fixed key. On Vercel, X-Forwarded-For is set by the edge.
 */
export function getCallerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Reset all rate limit state. For testing only. */
export function _resetRateLimitForTesting(): void {
  store = new Map();
}
