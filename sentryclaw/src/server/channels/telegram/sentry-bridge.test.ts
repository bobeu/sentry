import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTelegramSlashCommand } from "@/server/channels/telegram/adapter";
import { getChannelCommandDefinitions } from "@/shared/channel-commands";

test("Sentry telegram menu includes poll and excludes generic ask", () => {
  const names = getChannelCommandDefinitions()
    .filter((c) => c.telegram.enabled)
    .map((c) => c.name);
  assert.ok(names.includes("poll"));
  assert.ok(names.includes("status"));
  assert.ok(!names.includes("ask"));
});

test("normalizeTelegramSlashCommand handles bot mention", () => {
  assert.deepEqual(
    normalizeTelegramSlashCommand("/poll@tgemployeebot", "tgemployeebot"),
    { shouldHandle: true, text: "/poll" },
  );
  assert.deepEqual(
    normalizeTelegramSlashCommand("/status@otherbot", "tgemployeebot"),
    { shouldHandle: false, text: "/status@otherbot" },
  );
});
