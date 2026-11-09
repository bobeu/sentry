const SLACK_AUTH_TEST_URL = "https://slack.com/api/auth.test";
const SLACK_AUTH_TEST_TIMEOUT_MS = 15_000;

export type SlackAuthIdentity = {
  team: string;
  user: string;
  botId: string;
};

type SlackAuthPayload = {
  ok?: boolean;
  team?: unknown;
  user?: unknown;
  bot_id?: unknown;
  error?: unknown;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`slack_auth_invalid_${field}`);
  }
  return value;
}

export async function fetchSlackAuthIdentity(
  botToken: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<SlackAuthIdentity> {
  const response = await fetchFn(SLACK_AUTH_TEST_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${botToken}`,
    },
    signal: AbortSignal.timeout(SLACK_AUTH_TEST_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as SlackAuthPayload | null;
  if (!response.ok || payload?.ok !== true) {
    const code =
      typeof payload?.error === "string" && payload.error.length > 0
        ? payload.error
        : `status_${response.status}`;
    throw new Error(`slack_auth_failed:${code}`);
  }

  return {
    team: requiredString(payload.team, "team"),
    user: requiredString(payload.user, "user"),
    botId: requiredString(payload.bot_id, "bot_id"),
  };
}
