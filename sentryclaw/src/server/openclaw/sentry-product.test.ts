import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SENTRY_API_BASE_URL,
  buildSentryAgentsMd,
  buildSentryApiScript,
  buildSentryApiSkill,
  buildSentryIdentityMd,
  buildSentrySoulMd,
  resolveSentryApiBaseUrl,
} from "@/server/openclaw/sentry-product";

test("resolveSentryApiBaseUrl defaults to production Sentry URL", () => {
  const prev = process.env.SENTRY_API_BASE_URL;
  delete process.env.SENTRY_API_BASE_URL;
  try {
    assert.equal(resolveSentryApiBaseUrl(), DEFAULT_SENTRY_API_BASE_URL);
  } finally {
    if (prev === undefined) delete process.env.SENTRY_API_BASE_URL;
    else process.env.SENTRY_API_BASE_URL = prev;
  }
});

test("Sentry persona is public Telegram employee", () => {
  assert.match(buildSentryIdentityMd(), /@tgemployeebot/);
  assert.match(buildSentrySoulMd(), /not.*private founder assistant/i);
  assert.match(buildSentryAgentsMd(), /engagement_event|start_engagement/);
  assert.match(buildSentryApiSkill(), /engagement_event|engagement_status/);
  assert.match(buildSentryApiScript(), /engagement_event|option-ids/);
});
