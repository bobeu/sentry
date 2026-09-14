# SentryClaw (OpenClaw on Vercel)

Hosted OpenClaw that powers **@tgemployeebot** — the public Sentry Telegram employee replacing `@tgemployee_bot`.

- **Sentry product / billing / tools:** `../ui` → https://sentry-sigma-two.vercel.app  
- **OpenClaw control plane:** this folder → https://sentryclaw.vercel.app  
- **Bridge:** `sentry-api` skill → `POST /api/agent/v1/tasks` with `SENTRY_AGENT_API_KEY`

## Architecture

OpenClaw = conversation brain + tool router.  
Sentry `ui` = employment, Prisma, Celo billing, FAQs, rewards, moderation APIs, AskBot, analytics.

Telegram DM/group policies on the gateway are **open** so all users can interact. Grand admin (`805099765`) gets AskBot + analytics via server-side checks. `OPENCLAW_OWNER_ALLOW_FROM` only gates OpenClaw owner tooling (cron/gateway), not product access.

## Secrets

| Variable | Notes |
|----------|--------|
| `ADMIN_SECRET` | SentryClaw admin UI |
| `REDIS_URL` | Required |
| `SENTRY_API_BASE_URL` | Default `https://sentry-sigma-two.vercel.app` |
| `SENTRY_AGENT_API_KEY` | Employer `sk_sentry_…` (who pays for tool calls) |
| `OPENCLAW_OWNER_ALLOW_FROM` | e.g. `805099765` |
| `CRON_SECRET` / `OPENCLAW_PACKAGE_SPEC` | Recommended |
| AI Gateway | OIDC on Vercel (no direct OpenAI key required) |

## Operator

```bash
npx @vercel/vclaw verify --url https://sentryclaw.vercel.app --admin-secret "<ADMIN_SECRET>"
```

See `../ui/docs/EMPLOYEE_TOOL_API.md` and `../ui/docs/CUTOVER.md`.
