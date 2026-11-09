import { randomBytes } from "node:crypto";

import { requireMutationAuth, authJsonOk } from "@/server/auth/route-auth";
import { ApiError, jsonError } from "@/shared/http";
import { getInitializedMeta, getStore, mutateMeta } from "@/server/store/store";
import {
  generateDiscordSmokeKeyPair,
  signDiscordPayload,
  signSlackPayload,
  signWhatsAppPayload,
} from "@/server/smoke/remote-crypto";
import { extractRequestId, logInfo, logWarn } from "@/server/log";
import { buildPublicDisplayUrl, buildPublicUrl } from "@/server/public-url";

const DISCORD_SMOKE_PRIVATE_KEY_STORE_KEY =
  "smoke:discord:private-key-pkcs8-pem";

const MAX_SMOKE_WEBHOOK_BYTES = 64 * 1024;

type SmokeChannel = "slack" | "telegram" | "discord" | "whatsapp";

function parseSmokeDispatchInput(
  input: unknown,
): { channel: SmokeChannel; payloadBody: string; payloadBytes: number } {
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "INVALID_JSON", "Request body must be a JSON object.");
  }

  const raw = input as { channel?: unknown; body?: unknown };
  if (
    raw.channel !== "slack" &&
    raw.channel !== "telegram" &&
    raw.channel !== "discord" &&
    raw.channel !== "whatsapp"
  ) {
    throw new ApiError(
      400,
      "UNSUPPORTED_CHANNEL",
      "Only slack, telegram, discord, and whatsapp are supported.",
    );
  }

  if (typeof raw.body !== "string") {
    throw new ApiError(
      400,
      "MISSING_FIELDS",
      "channel and body are required strings.",
    );
  }

  const payloadBytes = Buffer.byteLength(raw.body, "utf8");
  if (payloadBytes === 0) {
    throw new ApiError(400, "EMPTY_BODY", "body must not be empty.");
  }
  if (payloadBytes > MAX_SMOKE_WEBHOOK_BYTES) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      `body must be at most ${MAX_SMOKE_WEBHOOK_BYTES} bytes.`,
    );
  }

  return { channel: raw.channel, payloadBody: raw.body, payloadBytes };
}

function buildSmokeDispatchUrl(
  channel: SmokeChannel,
  request: Request,
): string {
  switch (channel) {
    case "slack":
      return buildPublicUrl("/api/channels/slack/webhook", request);
    case "telegram":
      return buildPublicUrl("/api/channels/telegram/webhook", request);
    case "discord":
      return buildPublicUrl("/api/channels/discord/webhook", request);
    case "whatsapp":
      return buildPublicUrl("/api/channels/whatsapp/webhook", request);
  }
}

/**
 * Smoke testing endpoint for channel webhooks.
 *
 * PUT  — Configure test channels with generated credentials (bypasses
 *        platform API validation). Sets up Slack, Telegram, Discord, and
 *        WhatsApp with generated credentials so smoke webhooks can be sent.
 *
 * POST — Sign and send a webhook payload to the local webhook endpoint.
 *        Raw secrets never leave the server.
 *
 * DELETE — Remove test channel configurations.
 */

// ---- PUT: configure test channels ----------------------------------------

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireMutationAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const now = Date.now();
    const slackSigningSecret = randomBytes(32).toString("hex");
    const telegramWebhookSecret = randomBytes(24).toString("base64url");
    const whatsappVerifyToken = randomBytes(24).toString("base64url");
    const whatsappAppSecret = randomBytes(32).toString("hex");
    const discordKeys = generateDiscordSmokeKeyPair();
    const telegramWebhookUrl = buildPublicDisplayUrl(
      "/api/channels/telegram/webhook",
      request,
    );

    await mutateMeta((meta) => {
      meta.channels.slack = {
        signingSecret: slackSigningSecret,
        botToken: "xoxb-smoke-test-token",
        configuredAt: now,
        team: "Smoke Test",
        user: "smoke-bot",
        botId: "B_SMOKE",
      };
      meta.channels.telegram = {
        botToken: "000000000:smoke-test-bot-token",
        webhookSecret: telegramWebhookSecret,
        webhookUrl: telegramWebhookUrl,
        botUsername: "smoke_test_bot",
        configuredAt: now,
      };
      meta.channels.discord = {
        publicKey: discordKeys.publicKeyHex,
        applicationId: "discord-smoke-app",
        botToken: "discord-smoke-bot-token",
        configuredAt: now,
      };
      meta.channels.whatsapp = {
        enabled: true,
        configuredAt: now,
        phoneNumberId: "123456789",
        accessToken: "wa-smoke-access-token",
        verifyToken: whatsappVerifyToken,
        appSecret: whatsappAppSecret,
        businessAccountId: "wa-smoke-business-account",
        displayName: "Smoke Test WhatsApp",
        lastKnownLinkState: "linked",
      };
    });
    await getStore().setValue(
      DISCORD_SMOKE_PRIVATE_KEY_STORE_KEY,
      discordKeys.privateKeyPkcs8Pem,
    );

    logInfo("admin.smoke_channels_configured", {
      slack: true,
      telegram: true,
      discord: true,
      whatsapp: true,
    });
    return authJsonOk(
      { configured: true, channels: ["slack", "telegram", "discord", "whatsapp"] },
      auth,
    );
  } catch (error) {
    logWarn("admin.smoke_channels_configure_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(new ApiError(503, "CONFIGURE_FAILED", "Failed to configure test channels."));
  }
}

// ---- POST: sign and send webhook -----------------------------------------

export async function POST(request: Request): Promise<Response> {
  const auth = await requireMutationAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const requestId = extractRequestId(request);

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return jsonError(
      new ApiError(400, "INVALID_JSON", "Request body must be valid JSON."),
    );
  }

  let parsed: {
    channel: SmokeChannel;
    payloadBody: string;
    payloadBytes: number;
  };
  try {
    parsed = parseSmokeDispatchInput(rawInput);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error);
    }
    throw error;
  }

  const { channel, payloadBody, payloadBytes } = parsed;
  const targetUrl = buildSmokeDispatchUrl(channel, request);

  logInfo("admin.smoke_webhook_dispatch_requested", {
    requestId,
    channel,
    payloadBytes,
  });

  try {
    const meta = await getInitializedMeta();

    if (channel === "slack") {
      const config = meta.channels.slack;
      if (!config) {
        return authJsonOk({ configured: false, sent: false, channel }, auth);
      }

      const headers = signSlackPayload(config.signingSecret, payloadBody);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: payloadBody,
      });

      logInfo("admin.smoke_webhook_dispatch_completed", {
        requestId,
        channel,
        status: res.status,
        ok: res.ok,
      });
      return authJsonOk(
        { configured: true, sent: res.ok, status: res.status, channel },
        auth,
      );
    }

    if (channel === "telegram") {
      const config = meta.channels.telegram;
      if (!config) {
        return authJsonOk({ configured: false, sent: false, channel }, auth);
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": config.webhookSecret,
        },
        body: payloadBody,
      });

      logInfo("admin.smoke_webhook_dispatch_completed", {
        requestId,
        channel,
        status: res.status,
        ok: res.ok,
      });
      return authJsonOk(
        { configured: true, sent: res.ok, status: res.status, channel },
        auth,
      );
    }

    if (channel === "whatsapp") {
      const config = meta.channels.whatsapp;
      if (!config?.enabled || !config.appSecret) {
        return authJsonOk({ configured: false, sent: false, channel }, auth);
      }

      const headers = signWhatsAppPayload(config.appSecret, payloadBody);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: payloadBody,
      });

      logInfo("admin.smoke_webhook_dispatch_completed", {
        requestId,
        channel,
        status: res.status,
        ok: res.ok,
      });
      return authJsonOk(
        { configured: true, sent: res.ok, status: res.status, channel },
        auth,
      );
    }

    // discord
    const config = meta.channels.discord;
    if (!config) {
      return authJsonOk({ configured: false, sent: false, channel }, auth);
    }

    const privateKeyPkcs8Pem = await getStore().getValue<string>(
      DISCORD_SMOKE_PRIVATE_KEY_STORE_KEY,
    );
    if (!privateKeyPkcs8Pem) {
      return jsonError(
        new ApiError(
          409,
          "DISCORD_SMOKE_KEY_MISSING",
          "Discord smoke signing key is not configured.",
        ),
      );
    }

    const headers = signDiscordPayload(privateKeyPkcs8Pem, payloadBody);
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: payloadBody,
    });

    logInfo("admin.smoke_webhook_dispatch_completed", {
      requestId,
      channel,
      status: res.status,
      ok: res.ok,
    });
    return authJsonOk(
      { configured: true, sent: res.ok, status: res.status, channel },
      auth,
    );
  } catch (error) {
    logWarn("admin.smoke_webhook_failed", {
      requestId,
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(
      new ApiError(503, "SEND_FAILED", "Failed to send smoke webhook."),
    );
  }
}

// ---- DELETE: remove test channels ----------------------------------------

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireMutationAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    await mutateMeta((meta) => {
      meta.channels.slack = null;
      meta.channels.telegram = null;
      meta.channels.discord = null;
      meta.channels.whatsapp = null;
    });
    await getStore().deleteValue(DISCORD_SMOKE_PRIVATE_KEY_STORE_KEY);
    logInfo("admin.smoke_channels_removed", {});
    return authJsonOk({ removed: true }, auth);
  } catch (error) {
    logWarn("admin.smoke_channels_remove_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(new ApiError(503, "REMOVE_FAILED", "Failed to remove test channels."));
  }
}
