import {
  resolveSentryAgentApiKey,
  resolveSentryApiBaseUrl,
} from "@/server/openclaw/sentry-product";
import { getChannelCommandDefinitions } from "@/shared/channel-commands";
import {
  answerCallbackQuery,
  sendMessage,
  type TelegramSendMessageResult,
} from "@/server/channels/telegram/bot-api";
import { normalizeTelegramSlashCommand } from "@/server/channels/telegram/adapter";
import { logInfo, logWarn } from "@/server/log";

export type SentryBridgeResult =
  | { handled: false; shouldForward: true; listenOnly?: false }
  | {
      handled: boolean;
      shouldForward: boolean;
      listenOnly?: boolean;
      kind?: string;
      reason?: string | null;
    };

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: { id?: number; type?: string; title?: string };
  from?: { id?: number; username?: string; first_name?: string };
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    user?: { id?: number };
  }>;
  reply_to_message?: { from?: { id?: number; is_bot?: boolean } };
};

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  from?: { id?: number; username?: string; first_name?: string };
  message?: { chat?: { id?: number; type?: string }; message_id?: number };
};

const SENTRY_COMMAND_NAMES = new Set(
  getChannelCommandDefinitions()
    .filter((c) => c.telegram.enabled)
    .map((c) => c.name),
);

async function callSentryTask(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const apiKey = resolveSentryAgentApiKey();
  if (!apiKey) {
    return { ok: false, error: "SENTRY_AGENT_API_KEY missing on server" };
  }
  const baseUrl = resolveSentryApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/agent/v1/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`,
      };
    }
    const result =
      payload.result && typeof payload.result === "object"
        ? (payload.result as Record<string, unknown>)
        : payload;
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("channels.telegram_sentry_task_fetch_error", { error: msg });
    return { ok: false, error: `Sentry API error: ${msg}` };
  }
}

function extractMessage(payload: unknown): TelegramMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const update = payload as Record<string, unknown>;
  const message =
    update.message ?? update.edited_message ?? update.channel_post;
  if (!message || typeof message !== "object") return null;
  return message as TelegramMessage;
}

function messageAddressesBot(
  message: TelegramMessage,
  botUsername: string,
  botId?: number,
): boolean {
  const text = message.text ?? "";
  const normalized = normalizeTelegramSlashCommand(text, botUsername);
  if (!normalized.shouldHandle) return false;

  const lower = text.toLowerCase();
  const tags = [
    botUsername ? `@${botUsername}` : "",
    "@sentry",
    "@tgemployee_bot",
    "@tgemployeebot",
  ].filter(Boolean);
  if (tags.some((t) => lower.includes(t))) return true;
  if (/(^|\s)sentry([,:\s]|$)/i.test(text)) return true;
  if (botId && message.reply_to_message?.from?.id === botId) return true;

  for (const entity of message.entities ?? []) {
    if (entity.type === "mention") {
      const slice = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
      if (
        slice === `@${botUsername}` ||
        slice === "@tgemployee_bot" ||
        slice === "@tgemployeebot" ||
        slice === "@sentry"
      ) {
        return true;
      }
    }
    if (entity.type === "text_mention" && botId && entity.user?.id === botId) {
      return true;
    }
  }
  return false;
}

function parseSlashCommand(text: string, botUsername: string): {
  command: string | null;
  args: string;
} {
  const normalized = normalizeTelegramSlashCommand(text.trim(), botUsername);
  if (!normalized.shouldHandle) return { command: null, args: "" };
  const match = /^\/([a-z0-9_]+)(?:\s+(.*))?$/iu.exec(normalized.text.trim());
  if (!match) return { command: null, args: "" };
  return { command: match[1]!.toLowerCase(), args: (match[2] ?? "").trim() };
}

function taskForCommand(command: string): Record<string, unknown> | null {
  switch (command) {
    case "start":
    case "menu":
    case "help":
      return { task: "employer_help" };
    case "status":
    case "balance":
    case "report":
      return { task: "status" };
    case "mywallet":
    case "deposit":
      return { task: "wallet_status" };
    case "groups":
      return { task: "list_groups" };
    case "points":
    case "mystatus":
      return { task: "points_status" };
    case "poll":
      return { task: "start_engagement", engagementKind: "poll" };
    case "trivia":
      return { task: "start_engagement", engagementKind: "trivia" };
    case "askbot":
      return { task: "askbot" };
    default:
      return null;
  }
}

function formatTaskReply(result: Record<string, unknown>, command: string): {
  text: string;
  replyMarkup?: unknown;
} {
  if (typeof result.message === "string" && result.message.trim()) {
    return {
      text: result.message,
      replyMarkup: result.replyMarkup ?? undefined,
    };
  }
  if (command === "status" || command === "balance" || command === "report") {
    const employment = result.employment ?? "None";
    const balance = result.availableBalance ?? result.balance ?? "?";
    const currency = result.currency ?? "";
    return {
      text: `Employment: ${employment}\nAvailable balance: ${balance} ${currency}`.trim(),
    };
  }
  if (command === "mywallet" || command === "deposit") {
    if (result.ok === false && typeof result.message === "string") {
      return { text: result.message };
    }
    return {
      text: [
        `Wallet: ${result.address ?? "—"}`,
        `Balance: ${result.formattedAvailable ?? result.formattedBalance ?? result.balance ?? "—"}`,
        result.formattedAvailable ? "Send Celo/stablecoins to this address to fund employment." : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  if (command === "groups" && Array.isArray(result.groups)) {
    const lines = (result.groups as Array<{ name?: string; enabled?: boolean }>).map(
      (g, i) => `${i + 1}. ${g.name ?? "Group"}${g.enabled ? "" : " (disabled)"}`,
    );
    return { text: lines.length ? lines.join("\n") : "No groups linked yet." };
  }
  if (command === "poll" || command === "trivia") {
    if (result.delivered === true) {
      const mode = result.deliveryMode ?? "interactive";
      const title =
        result.activity && typeof result.activity === "object"
          ? (result.activity as { title?: string }).title
          : null;
      return {
        text: title
          ? `Posted to the group: ${title} (${mode}). Tap the poll/buttons to participate.`
          : `Posted to the group (${mode}). Tap the poll/buttons to participate.`,
      };
    }
    if (typeof result.instruction === "string") {
      return { text: result.instruction };
    }
    return { text: "Could not post that activity — check group settings and wallet funds." };
  }
  if (typeof result.instruction === "string") {
    return { text: result.instruction };
  }
  if (typeof result.answer === "string") {
    return { text: result.answer };
  }
  return { text: JSON.stringify(result, null, 2).slice(0, 3500) };
}

async function sendBridgeReply(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown,
  replyToMessageId?: number,
): Promise<TelegramSendMessageResult | null> {
  try {
    return await sendMessage(botToken, chatId, text, {
      replyMarkup,
      replyToMessageId,
    });
  } catch (err) {
    logWarn("channels.telegram_sentry_bridge_send_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Product bridge for @tgemployeebot: log group context, handle slash commands
 * and employer inline buttons deterministically, and gate when OpenClaw should
 * stay silent in group banter.
 */
export async function tryHandleSentryTelegramUpdate(input: {
  payload: unknown;
  botToken: string;
  botUsername: string;
  botId?: number;
  requestId?: string | null;
}): Promise<SentryBridgeResult> {
  if (!input.payload || typeof input.payload !== "object") {
    return { handled: false, shouldForward: true };
  }

  const update = input.payload as Record<string, unknown>;
  const botUsername = input.botUsername.replace(/^@/, "").toLowerCase();

  // Employer inline menus (emp:*)
  const callback = update.callback_query as TelegramCallbackQuery | undefined;
  const callbackData = typeof callback?.data === "string" ? callback.data : "";
  if (callback?.id && callbackData.startsWith("emp:") && callback.from?.id) {
    const telegramUserId = String(callback.from.id);
    const chatId =
      typeof callback.message?.chat?.id === "number"
        ? String(callback.message.chat.id)
        : undefined;

    const outcome = await callSentryTask({
      task: "employer_callback",
      callbackData,
      telegramUserId,
      chatId,
    });

    const replyText =
      outcome.ok && outcome.result
        ? (typeof outcome.result.message === "string" && outcome.result.message) ||
          (typeof outcome.result.answerText === "string" && outcome.result.answerText) ||
          "Done."
        : outcome.error ?? "Could not process that button.";

    try {
      await answerCallbackQuery(input.botToken, callback.id, {
        text: replyText.slice(0, 180),
        showAlert: false,
      });
    } catch {
      // non-fatal
    }

    if (chatId && outcome.result?.message) {
      await sendBridgeReply(
        input.botToken,
        Number(chatId),
        String(outcome.result.message),
        outcome.result.replyMarkup,
      );
    }

    logInfo("channels.telegram_sentry_employer_callback", {
      requestId: input.requestId ?? null,
      ok: outcome.ok,
      data: callbackData,
    });

    return {
      handled: true,
      shouldForward: false,
      kind: "employer_callback",
    };
  }

  const message = extractMessage(input.payload);
  if (!message?.chat?.id || !message.text) {
    return { handled: false, shouldForward: true };
  }

  const chatId = String(message.chat.id);
  const chatType = message.chat.type ?? "group";
  const telegramUserId = message.from?.id ? String(message.from.id) : undefined;
  const username = message.from?.username ?? message.from?.first_name ?? undefined;
  const addressed = messageAddressesBot(message, botUsername, input.botId);
  const text = message.text;

  // Always log group/supergroup messages for rolling context (best-effort).
  if (chatType === "group" || chatType === "supergroup") {
    void callSentryTask({
      task: "log_group_message",
      chatId,
      chatType,
      messageText: text,
      telegramUserId,
      username,
      telegramMessageId: message.message_id ? String(message.message_id) : undefined,
      addressed,
      botUsername,
    }).catch(() => undefined);
  }

  const { command, args } = parseSlashCommand(text, botUsername);
  if (command && SENTRY_COMMAND_NAMES.has(command)) {
    const taskBody = taskForCommand(command);
    if (taskBody) {
      const outcome = await callSentryTask({
        ...taskBody,
        chatId,
        chatType,
        telegramUserId,
        username,
        messageText: args || undefined,
        question: args || undefined,
      });

      const reply = outcome.ok && outcome.result
        ? formatTaskReply(outcome.result, command)
        : { text: outcome.error ?? "That command failed. Try again or ask in chat." };

      await sendBridgeReply(
        input.botToken,
        message.chat.id,
        reply.text,
        reply.replyMarkup,
        message.message_id,
      );

      logInfo("channels.telegram_sentry_command", {
        requestId: input.requestId ?? null,
        command,
        ok: outcome.ok,
      });

      return {
        handled: true,
        shouldForward: false,
        kind: `command_${command}`,
      };
    }
  }

  // Private chats and agent-worthy group messages forward to OpenClaw.
  if (chatType === "private") {
    return { handled: false, shouldForward: true };
  }

  if (chatType === "group" || chatType === "supergroup") {
    const evalOutcome = await callSentryTask({
      task: "evaluate_group_reply",
      chatId,
      chatType,
      messageText: text,
      telegramUserId,
      username,
      addressed,
      botUsername,
    });

    const evaluation = evalOutcome.result;
    const shouldReply =
      evalOutcome.ok &&
      evaluation &&
      typeof evaluation === "object" &&
      (evaluation as { shouldReply?: boolean }).shouldReply === true;

    if (!shouldReply) {
      logInfo("channels.telegram_sentry_listen_only", {
        requestId: input.requestId ?? null,
        chatId,
        reason:
          evaluation && typeof evaluation === "object"
            ? (evaluation as { reason?: string }).reason
            : null,
      });
      return {
        handled: true,
        shouldForward: false,
        listenOnly: true,
        kind: "listen_only",
        reason:
          evaluation && typeof evaluation === "object"
            ? ((evaluation as { reason?: string }).reason ?? null)
            : null,
      };
    }
  }

  return { handled: false, shouldForward: true };
}
