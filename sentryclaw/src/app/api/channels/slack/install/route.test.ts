import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { withHarness } from "@/test-utils/harness";
import { _setAiGatewayTokenOverrideForTesting } from "@/server/env";
import { patchNextServerAfter, buildGetRequest } from "@/test-utils/route-caller";

patchNextServerAfter();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require("@/app/api/channels/slack/install/route") as {
  GET: (request: Request) => Promise<Response>;
};

afterEach(() => {
  _setAiGatewayTokenOverrideForTesting(null);
  delete process.env.SLACK_CLIENT_ID;
  delete process.env.SLACK_CLIENT_SECRET;
  delete process.env.SLACK_SIGNING_SECRET;
});

test("slack install returns 401 without auth", async () => {
  await withHarness(async () => {
    const request = buildGetRequest("/api/channels/slack/install");
    const response = await GET(request);
    assert.equal(response.status, 401);
  });
});

test("slack install redirects with error when app credentials are missing", async () => {
  await withHarness(async () => {
    // No SLACK_CLIENT_ID etc. set
    const request = buildGetRequest("/api/channels/slack/install", {
      authorization: "Bearer test-admin-secret-for-scenarios",
    });
    const response = await GET(request);
    assert.equal(response.status, 302);
    const location = response.headers.get("location");
    assert.ok(location, "redirect location must be set");
    assert.ok(
      location.includes("slack_install_error=missing_app_credentials"),
      "error param indicates missing credentials",
    );
  });
});

test("slack install redirects to Slack authorize with correct params when configured", async () => {
  await withHarness(async () => {
    _setAiGatewayTokenOverrideForTesting("oidc-token");
    process.env.SLACK_CLIENT_ID = "test-client-id";
    process.env.SLACK_CLIENT_SECRET = "test-client-secret";
    process.env.SLACK_SIGNING_SECRET = "test-signing-secret";

    const request = new Request(
      "https://openclaw.example/api/channels/slack/install",
      {
        method: "GET",
        headers: {
          authorization: "Bearer test-admin-secret-for-scenarios",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "openclaw.example",
          host: "openclaw.example",
        },
      },
    );

    const response = await GET(request);
    assert.equal(response.status, 302);

    const location = response.headers.get("location");
    assert.ok(location, "redirect location must be set");
    assert.ok(
      location.startsWith("https://slack.com/oauth/v2/authorize"),
      "redirects to Slack authorize",
    );

    const redirectUrl = new URL(location);
    assert.equal(redirectUrl.searchParams.get("client_id"), "test-client-id");
    assert.ok(
      redirectUrl.searchParams.get("scope")?.includes("chat:write"),
      "includes bot scopes",
    );
    assert.ok(
      redirectUrl.searchParams.get("redirect_uri")?.includes("/api/channels/slack/install/callback"),
      "callback URL is correct",
    );
    assert.ok(
      redirectUrl.searchParams.get("state"),
      "state parameter is set",
    );

    // Check cookies are set
    const cookies = response.headers.getSetCookie();
    const stateC = cookies.find((c) => c.startsWith("slack_oauth_state="));
    const ctxC = cookies.find((c) => c.startsWith("slack_oauth_ctx="));
    assert.ok(stateC, "state cookie is set");
    assert.ok(ctxC, "context cookie is set");
  });
});
