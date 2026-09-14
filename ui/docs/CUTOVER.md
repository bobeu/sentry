# Cutover: @tgemployee_bot → @tgemployeebot (SentryClaw)

## Status

- Employee Tool API live under `POST /api/agent/v1/tasks`
- Telegraf handlers / inline buttons remain in [`ui/telegram/`](../telegram/) for parity and revert
- OpenClaw persona + `sentry-api` skill target public employee behavior
- Hobby cold starts accepted for now; upgrade plan later

## Pilot checklist

- [ ] Message @tgemployeebot in DM: identity, wallet, help menu
- [ ] Employer inline callbacks via `employer_callback` tool
- [ ] Enabled group: FAQ / generate_reply with context
- [ ] Admin moderation tool (ban/mute) in a test group
- [ ] Engagement start (poll/trivia)
- [ ] Grand admin: `/askbot` path via `askbot` task + Analytics page
- [ ] Billing: agent_task charges appear for billable tools

## Go-live

1. Tell employers to add **@tgemployeebot** and enable the group (same dashboard).
2. Confirm SentryClaw env: `SENTRY_API_BASE_URL`, `SENTRY_AGENT_API_KEY`, owner allowlist.
3. Point `ui` `TELEGRAM_BOT_TOKEN` at the **@tgemployeebot** token so shared services (moderation sends, employer DM helpers) use the live bot; keep the Telegram webhook on SentryClaw only.
4. When parity is accepted, remove **@tgemployee_bot** in BotFather.
5. Keep Agent API key for employer attribution on OpenClaw tool calls.

## Revert

Local snapshot of pre-migration UI source: `deprecated/` (gitignored). Restore by copying source back over `ui/` if needed.
