import { randomBytes } from "node:crypto";

import type { ChannelName } from "@/shared/channels";
import type { OperationContext, OperationTrigger, SingleStatus } from "@/shared/types";

/**
 * Generate a short, collision-resistant operation ID.
 * Format: `op_<12 hex chars>` (48 bits of entropy).
 */
function generateOpId(): string {
  return `op_${randomBytes(6).toString("hex")}`;
}

/**
 * Create a root operation context.
 *
 * Every async flow (webhook, admin action, heartbeat, watchdog, queue consumer)
 * should create one at ingress and thread it through all downstream calls.
 */
export function createOperationContext(input: {
  trigger: OperationTrigger;
  reason: string;
  requestId?: string | null;
  parentOpId?: string | null;
  channel?: ChannelName | null;
  messageId?: string | null;
  dedupId?: string | null;
  deliveryCount?: number | null;
  retryCount?: number | null;
  sandboxId?: string | null;
  snapshotId?: string | null;
  status?: SingleStatus | null;
}): OperationContext {
  return {
    opId: generateOpId(),
    parentOpId: input.parentOpId ?? null,
    trigger: input.trigger,
    reason: input.reason,
    requestId: input.requestId ?? null,
    channel: input.channel ?? null,
    messageId: input.messageId ?? null,
    dedupId: input.dedupId ?? null,
    deliveryCount: input.deliveryCount ?? null,
    retryCount: input.retryCount ?? null,
    sandboxId: input.sandboxId ?? null,
    snapshotId: input.snapshotId ?? null,
    status: input.status ?? null,
  };
}

/**
 * Create a child context that inherits the parent's opId as parentOpId
 * and gets a fresh opId of its own.
 *
 * Use this when a single ingress triggers a separable sub-operation
 * (e.g. a channel wake spawning a lifecycle restore).
 */
export function childOperationContext(
  parent: OperationContext,
  overrides: Partial<Omit<OperationContext, "opId">> & { reason: string },
): OperationContext {
  return {
    ...parent,
    ...overrides,
    opId: generateOpId(),
    parentOpId: parent.opId,
  };
}

/**
 * Flatten an OperationContext (plus optional extras) into a plain object
 * suitable for passing as the `ctx` parameter to `log()`.
 *
 * Null-valued fields are omitted so JSON logs stay compact.
 */
export function withOperationContext(
  ctx: OperationContext,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Always include opId
  out.opId = ctx.opId;

  // Include non-null context fields
  if (ctx.parentOpId !== null) out.parentOpId = ctx.parentOpId;
  out.trigger = ctx.trigger;
  if (ctx.reason) out.reason = ctx.reason;
  if (ctx.requestId !== null) out.requestId = ctx.requestId;
  if (ctx.channel !== null) out.channel = ctx.channel;
  if (ctx.messageId !== null) out.messageId = ctx.messageId;
  if (ctx.dedupId !== null) out.dedupId = ctx.dedupId;
  if (ctx.deliveryCount !== null) out.deliveryCount = ctx.deliveryCount;
  if (ctx.retryCount !== null) out.retryCount = ctx.retryCount;
  if (ctx.sandboxId !== null) out.sandboxId = ctx.sandboxId;
  if (ctx.snapshotId !== null) out.snapshotId = ctx.snapshotId;
  if (ctx.status !== null) out.status = ctx.status;

  // Merge extras last so callers can add phase-specific fields
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) {
        out[k] = v;
      }
    }
  }

  return out;
}
