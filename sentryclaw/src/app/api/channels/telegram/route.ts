import { ApiError } from "@/shared/http";
import { createChannelAdminRouteHandlers } from "@/server/channels/admin/route-factory";
import { getMe, getWebhookInfo, deleteWebhook, setWebhook } from "@/server/channels/telegram/bot-api";
import { syncTelegramCommands } from "@/server/channels/telegram/commands";
import {
  buildTelegramWebhookUrl,
  createTelegramWebhookSecret,
  setTelegramChannelConfig,
} from "@/server/channels/state";

const PREVIOUS_SECRET_GRACE_MS = 30 * 60 * 1000;

function parseBotToken(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, "INVALID_BOT_TOKEN", "botToken must be a non-empty string");
  }

  return value.trim();
}

export const { GET, PUT, DELETE } = createChannelAdminRouteHandlers({
  channel: "telegram",

  selectState(fullState) {
    return fullState.telegram;
  },

  async get({ state, url, meta }) {
    if (url.searchParams.get("diagnostics") !== "1" || !meta.channels.telegram?.botToken) {
      return state;
    }

    const webhookInfo = await getWebhookInfo(meta.channels.telegram.botToken).catch(() => null);
    return { ...state, webhookInfo };
  },

  async put({ request, meta }) {
    const body = (await request.json()) as { botToken?: unknown };
    const botToken = parseBotToken(body.botToken);
    const bot = await getMe(botToken);

    const current = meta.channels.telegram;
    const webhookSecret = createTelegramWebhookSecret();
    const webhookUrl = buildTelegramWebhookUrl(request);

    await setWebhook(botToken, webhookUrl, webhookSecret);

    const now = Date.now();
    let commandSyncStatus: "synced" | "error" = "synced";
    let commandSyncError: string | undefined;
    let commandsRegisteredAt: number | undefined = now;

    try {
      await syncTelegramCommands(botToken);
    } catch (error) {
      commandSyncStatus = "error";
      commandSyncError = error instanceof Error ? error.message : String(error);
      commandsRegisteredAt = undefined;
    }

    await setTelegramChannelConfig({
      botToken,
      webhookSecret,
      previousWebhookSecret: current?.webhookSecret,
      previousSecretExpiresAt: current?.webhookSecret ? now + PREVIOUS_SECRET_GRACE_MS : undefined,
      webhookUrl,
      botUsername: bot.username ?? "",
      configuredAt: now,
      commandSyncStatus,
      commandsRegisteredAt,
      commandSyncError,
    });
  },

  async delete({ meta }) {
    if (meta.channels.telegram?.botToken) {
      await deleteWebhook(meta.channels.telegram.botToken).catch(() => {});
    }

    await setTelegramChannelConfig(null);
  },
});
