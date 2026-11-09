import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createOperationContext,
  childOperationContext,
  withOperationContext,
} from "@/server/observability/operation-context";

describe("createOperationContext()", () => {
  it("generates a unique opId with op_ prefix", () => {
    const ctx = createOperationContext({
      trigger: "admin.ensure",
      reason: "manual ensure",
    });
    assert.ok(ctx.opId.startsWith("op_"), `Expected op_ prefix, got ${ctx.opId}`);
    assert.equal(ctx.opId.length, 15); // "op_" + 12 hex chars
  });

  it("generates distinct opIds on each call", () => {
    const a = createOperationContext({ trigger: "admin.ensure", reason: "a" });
    const b = createOperationContext({ trigger: "admin.ensure", reason: "b" });
    assert.notEqual(a.opId, b.opId);
  });

  it("defaults nullable fields to null", () => {
    const ctx = createOperationContext({
      trigger: "watchdog",
      reason: "periodic check",
    });
    assert.equal(ctx.parentOpId, null);
    assert.equal(ctx.requestId, null);
    assert.equal(ctx.channel, null);
    assert.equal(ctx.messageId, null);
    assert.equal(ctx.dedupId, null);
    assert.equal(ctx.deliveryCount, null);
    assert.equal(ctx.retryCount, null);
    assert.equal(ctx.sandboxId, null);
    assert.equal(ctx.snapshotId, null);
    assert.equal(ctx.status, null);
  });

  it("preserves all provided fields", () => {
    const ctx = createOperationContext({
      trigger: "channel.queue.consumer",
      reason: "channel:slack",
      requestId: "req-123",
      parentOpId: "op_parent123456",
      channel: "slack",
      messageId: "vq_abc",
      dedupId: "dedup_1",
      deliveryCount: 2,
      retryCount: 1,
      sandboxId: "sbx_xyz",
      snapshotId: "snap_abc",
      status: "stopped",
    });
    assert.equal(ctx.trigger, "channel.queue.consumer");
    assert.equal(ctx.reason, "channel:slack");
    assert.equal(ctx.requestId, "req-123");
    assert.equal(ctx.parentOpId, "op_parent123456");
    assert.equal(ctx.channel, "slack");
    assert.equal(ctx.messageId, "vq_abc");
    assert.equal(ctx.dedupId, "dedup_1");
    assert.equal(ctx.deliveryCount, 2);
    assert.equal(ctx.retryCount, 1);
    assert.equal(ctx.sandboxId, "sbx_xyz");
    assert.equal(ctx.snapshotId, "snap_abc");
    assert.equal(ctx.status, "stopped");
  });
});

describe("childOperationContext()", () => {
  it("creates a new opId and sets parentOpId to parent's opId", () => {
    const parent = createOperationContext({
      trigger: "channel.slack.webhook",
      reason: "incoming webhook",
      channel: "slack",
    });
    const child = childOperationContext(parent, {
      reason: "wake sandbox for slack",
      trigger: "channel.queue.consumer",
    });

    assert.notEqual(child.opId, parent.opId);
    assert.equal(child.parentOpId, parent.opId);
    assert.ok(child.opId.startsWith("op_"));
  });

  it("inherits parent fields not overridden", () => {
    const parent = createOperationContext({
      trigger: "channel.slack.webhook",
      reason: "incoming webhook",
      channel: "slack",
      sandboxId: "sbx_123",
    });
    const child = childOperationContext(parent, {
      reason: "lifecycle restore",
    });

    assert.equal(child.channel, "slack");
    assert.equal(child.sandboxId, "sbx_123");
    assert.equal(child.trigger, "channel.slack.webhook"); // inherited
  });

  it("allows overriding inherited fields", () => {
    const parent = createOperationContext({
      trigger: "channel.slack.webhook",
      reason: "incoming",
      status: "stopped",
    });
    const child = childOperationContext(parent, {
      reason: "restoring",
      status: "restoring",
      sandboxId: "sbx_new",
    });

    assert.equal(child.status, "restoring");
    assert.equal(child.sandboxId, "sbx_new");
    assert.equal(child.reason, "restoring");
  });
});

describe("withOperationContext()", () => {
  it("includes opId and trigger always", () => {
    const ctx = createOperationContext({
      trigger: "admin.ensure",
      reason: "manual",
    });
    const flat = withOperationContext(ctx);
    assert.equal(flat.opId, ctx.opId);
    assert.equal(flat.trigger, "admin.ensure");
    assert.equal(flat.reason, "manual");
  });

  it("omits null-valued fields", () => {
    const ctx = createOperationContext({
      trigger: "watchdog",
      reason: "periodic",
    });
    const flat = withOperationContext(ctx);
    assert.equal(flat.parentOpId, undefined);
    assert.equal(flat.requestId, undefined);
    assert.equal(flat.channel, undefined);
    assert.equal(flat.messageId, undefined);
    assert.equal(flat.sandboxId, undefined);
  });

  it("includes non-null fields", () => {
    const ctx = createOperationContext({
      trigger: "channel.queue.consumer",
      reason: "channel:slack",
      channel: "slack",
      messageId: "vq_123",
      deliveryCount: 2,
      sandboxId: "sbx_xyz",
      status: "stopped",
    });
    const flat = withOperationContext(ctx);
    assert.equal(flat.channel, "slack");
    assert.equal(flat.messageId, "vq_123");
    assert.equal(flat.deliveryCount, 2);
    assert.equal(flat.sandboxId, "sbx_xyz");
    assert.equal(flat.status, "stopped");
  });

  it("merges extra fields", () => {
    const ctx = createOperationContext({
      trigger: "admin.ensure",
      reason: "test",
    });
    const flat = withOperationContext(ctx, {
      phase: "local_ready",
      durationMs: 1234,
    });
    assert.equal(flat.phase, "local_ready");
    assert.equal(flat.durationMs, 1234);
    assert.equal(flat.opId, ctx.opId);
  });

  it("omits null/undefined extras", () => {
    const ctx = createOperationContext({
      trigger: "admin.ensure",
      reason: "test",
    });
    const flat = withOperationContext(ctx, {
      keep: "yes",
      drop: null,
      also_drop: undefined,
    });
    assert.equal(flat.keep, "yes");
    assert.equal(flat.drop, undefined);
    assert.equal(flat.also_drop, undefined);
  });

  it("extra fields override context fields", () => {
    const ctx = createOperationContext({
      trigger: "admin.ensure",
      reason: "original",
    });
    const flat = withOperationContext(ctx, { reason: "overridden" });
    assert.equal(flat.reason, "overridden");
  });
});
