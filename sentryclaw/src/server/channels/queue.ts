import { createHash } from "node:crypto";

import type { ChannelName } from "@/shared/channels";
import type { QueuedChannelJob } from "@/server/channels/driver";

/**
 * Resolve a deterministic idempotency key for a channel job.
 * Uses the explicit dedupId if present, otherwise SHA-256 of channel + payload.
 */
export function resolveIdempotencyKey<TPayload>(
  channel: ChannelName,
  job: QueuedChannelJob<TPayload>,
): string {
  const explicit = job.dedupId?.trim();
  if (explicit) {
    return `${channel}:${explicit}`;
  }

  try {
    return createHash("sha256")
      .update(channel)
      .update(":")
      .update(JSON.stringify(job.payload))
      .digest("hex");
  } catch {
    return createHash("sha256")
      .update(channel)
      .update(":")
      .update(String(job.receivedAt))
      .update(":")
      .update(job.origin)
      .digest("hex");
  }
}
