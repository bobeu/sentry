/**
 * Point Telegram webhook at this deployment's /api/telegram endpoint.
 *
 * Usage:
 *   bun run bot:webhook
 *   WEBHOOK_BASE_URL=https://your-host bun run bot:webhook
 */
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const base = (
  process.env.WEBHOOK_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  ""
)
  .trim()
  .replace(/\/$/, "");

if (!base) {
  console.error(
    "Set WEBHOOK_BASE_URL or NEXT_PUBLIC_API_URL (e.g. https://sentry-sigma-two.vercel.app)",
  );
  process.exit(1);
}

const webhookUrl = base.startsWith("http")
  ? `${base}/api/telegram`
  : `https://${base}/api/telegram`;

const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

async function main() {
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error("Invalid TELEGRAM_BOT_TOKEN:", me.description);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username} (${me.result.id})`);

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: [
      "message",
      "edited_message",
      "my_chat_member",
      "chat_member",
      "callback_query",
      "poll_answer",
      "business_connection",
      "business_message",
      "edited_business_message",
      "deleted_business_messages",
      "managed_bot",
    ],
    drop_pending_updates: false,
  };
  if (secret) body.secret_token = secret;

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const setJson = await setRes.json();
  if (!setJson.ok) {
    console.error("setWebhook failed:", setJson.description);
    process.exit(1);
  }
  console.log(`Webhook set → ${webhookUrl}`);

  // Register `/` command menus (private vs group scopes).
  const { Telegraf } = await import("telegraf");
  const { registerBotCommandMenu } = await import("../telegram/bot-commands");
  const bot = new Telegraf(token as string);
  await registerBotCommandMenu(bot);
  console.log("Bot command menus registered");

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log(
    JSON.stringify(
      {
        url: info.result?.url,
        pending_update_count: info.result?.pending_update_count,
        last_error_message: info.result?.last_error_message ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
