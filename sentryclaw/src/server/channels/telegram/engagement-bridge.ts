import {
  resolveSentryAgentApiKey,
  resolveSentryApiBaseUrl,
} from "@/server/openclaw/sentry-product";
import { answerCallbackQuery, sendMessage } from "@/server/channels/telegram/bot-api";
import { logInfo, logWarn } from "@/server/log";

export type SentryEngagementBridgeResult =
  | { handled: false }
  | {
      handled: true;
      kind: "poll_answer" | "quiz_callback";
      replyText?: string | null;
      chatId?: string | null;
      userId?: string | null;
    };

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  from?: { id?: number; username?: string; first_name?: string };
  message?: { chat?: { id?: number }; message_id?: number };
};

type TelegramPollAnswer = {
  poll_id?: string;
  user?: { id?: number; username?: string; first_name?: string };
  option_ids?: number[];
};

async function callSentryEngagementEvent(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const apiKey = resolveSentryAgentApiKey();
  if (!apiKey) {
    return { ok: false, error: "SENTRY_AGENT_API_KEY missing" };
  }
  const baseUrl = resolveSentryApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/agent/v1/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ task: "engagement_event", ...body }),
    signal: AbortSignal.timeout(20_000),
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
}

/**
 * Deterministically handle native poll votes and inline quiz taps without
 * waking the LLM. Returns handled:false for normal chat/callback flows.
 */
export async function tryHandleSentryEngagementUpdate(input: {
  payload: unknown;
  botToken: string;
  requestId?: string | null;
}): Promise<SentryEngagementBridgeResult> {
  if (!input.payload || typeof input.payload !== "object") {
    return { handled: false };
  }
  const update = input.payload as Record<string, unknown>;

  const pollAnswer = update.poll_answer as TelegramPollAnswer | undefined;
  if (pollAnswer?.poll_id && pollAnswer.user?.id) {
    const telegramUserId = String(pollAnswer.user.id);
    const username =
      pollAnswer.user.username ?? pollAnswer.user.first_name ?? undefined;
    const optionIds = Array.isArray(pollAnswer.option_ids)
      ? pollAnswer.option_ids.filter((n) => typeof n === "number")
      : [];

    const outcome = await callSentryEngagementEvent({
      engagementEventKind: "poll_answer",
      pollId: pollAnswer.poll_id,
      optionIds,
      telegramUserId,
      username,
    });

    logInfo("channels.telegram_engagement_poll_answer", {
      requestId: input.requestId ?? null,
      ok: outcome.ok,
      pollId: pollAnswer.poll_id,
      telegramUserId,
      error: outcome.error ?? null,
    });

    const replyText =
      outcome.ok && typeof outcome.result?.message === "string"
        ? outcome.result.message
        : null;
    if (replyText) {
      try {
        await sendMessage(input.botToken, Number(telegramUserId), replyText);
      } catch (err) {
        logWarn("channels.telegram_engagement_dm_failed", {
          requestId: input.requestId ?? null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      handled: true,
      kind: "poll_answer",
      replyText,
      userId: telegramUserId,
      chatId: null,
    };
  }

  const callback = update.callback_query as TelegramCallbackQuery | undefined;
  const data = typeof callback?.data === "string" ? callback.data : "";
  if (callback?.id && data.startsWith("q:") && callback.from?.id) {
    const telegramUserId = String(callback.from.id);
    const username =
      callback.from.username ?? callback.from.first_name ?? undefined;
    const chatId =
      typeof callback.message?.chat?.id === "number"
        ? String(callback.message.chat.id)
        : null;

    const outcome = await callSentryEngagementEvent({
      engagementEventKind: "quiz_callback",
      callbackData: data,
      telegramUserId,
      username,
      chatId: chatId ?? undefined,
    });

    const replyText =
      outcome.ok && typeof outcome.result?.message === "string"
        ? outcome.result.message
        : outcome.ok
          ? "Answer recorded."
          : outcome.error ?? "Could not score that answer.";

    try {
      await answerCallbackQuery(input.botToken, callback.id, {
        text: replyText.slice(0, 180),
        showAlert: false,
      });
    } catch (err) {
      logWarn("channels.telegram_engagement_answer_cb_failed", {
        requestId: input.requestId ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (chatId && replyText) {
      try {
        await sendMessage(input.botToken, Number(chatId), replyText);
      } catch {
        // Non-fatal — callback toast already acknowledged the tap.
      }
    }

    logInfo("channels.telegram_engagement_quiz_callback", {
      requestId: input.requestId ?? null,
      ok: outcome.ok,
      telegramUserId,
      chatId,
      data,
      error: outcome.error ?? null,
    });

    return {
      handled: true,
      kind: "quiz_callback",
      replyText,
      chatId,
      userId: telegramUserId,
    };
  }

  return { handled: false };
}
