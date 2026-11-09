/**
 * Tests for src/server/channels/queue.ts.
 *
 * Covers: idempotency key generation.
 *
 * Run: npm test src/server/channels/queue.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { QueuedChannelJob } from "@/server/channels/driver";
import { resolveIdempotencyKey } from "@/server/channels/queue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJob(
  overrides: Partial<QueuedChannelJob<{ text: string }>> = {},
): QueuedChannelJob<{ text: string }> {
  return {
    payload: { text: "hello" },
    receivedAt: 1,
    origin: "https://app.test",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveIdempotencyKey
// ---------------------------------------------------------------------------

test("resolveIdempotencyKey uses explicit dedupId prefixed with channel", () => {
  const job = createJob({ dedupId: "explicit-key-123" });
  const key = resolveIdempotencyKey("slack", job);
  assert.equal(key, "slack:explicit-key-123");
});

test("resolveIdempotencyKey trims whitespace from dedupId", () => {
  const job = createJob({ dedupId: "  spaced-key  " });
  const key = resolveIdempotencyKey("telegram", job);
  assert.equal(key, "telegram:spaced-key");
});

test("resolveIdempotencyKey uses SHA-256 hash when no dedupId", () => {
  const job = createJob();
  const key = resolveIdempotencyKey("discord", job);

  const expected = createHash("sha256")
    .update("discord")
    .update(":")
    .update(JSON.stringify(job.payload))
    .digest("hex");
  assert.equal(key, expected);
});

test("resolveIdempotencyKey is deterministic for same payload", () => {
  const job1 = createJob({ payload: { text: "same" } });
  const job2 = createJob({ payload: { text: "same" }, receivedAt: 999 });

  const key1 = resolveIdempotencyKey("slack", job1);
  const key2 = resolveIdempotencyKey("slack", job2);
  assert.equal(key1, key2, "Same payload should produce same idempotency key");
});

test("resolveIdempotencyKey differs for different payloads", () => {
  const job1 = createJob({ payload: { text: "hello" } });
  const job2 = createJob({ payload: { text: "world" } });

  const key1 = resolveIdempotencyKey("slack", job1);
  const key2 = resolveIdempotencyKey("slack", job2);
  assert.notEqual(key1, key2, "Different payloads should produce different keys");
});

test("resolveIdempotencyKey differs across channels for same payload", () => {
  const job = createJob();

  const keySlack = resolveIdempotencyKey("slack", job);
  const keyTelegram = resolveIdempotencyKey("telegram", job);
  const keyDiscord = resolveIdempotencyKey("discord", job);

  assert.notEqual(keySlack, keyTelegram);
  assert.notEqual(keySlack, keyDiscord);
  assert.notEqual(keyTelegram, keyDiscord);
});

test("resolveIdempotencyKey ignores empty/whitespace dedupId", () => {
  const job = createJob({ dedupId: "   " });
  const key = resolveIdempotencyKey("slack", job);

  const expectedHash = createHash("sha256")
    .update("slack")
    .update(":")
    .update(JSON.stringify(job.payload))
    .digest("hex");
  assert.equal(key, expectedHash);
});
