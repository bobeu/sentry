# Sentry

An AI employee for Telegram that businesses and individuals hire to monitor conversations, welcome members, answer mentions, moderate spam, and generate summaries — billed per completed action from a prepaid employment wallet on **Celo Mainnet**.

## Overview

Sentry is a pay-per-completed-work product:

1. User hires Sentry and receives an employment wallet address.
2. User funds the wallet (direct transfer or on-chain deposit).
3. Sentry joins Telegram groups and performs billable work.
4. Each completed action triggers an on-chain `charge()` — **blockchain is the source of truth**.
5. When balance reaches zero, employment exhausts automatically.

Supported payment currencies (global, admin-configured): **CELO**, **USDm**, **USDC**, **USDT**.

## Tech stack

- Next.js 15 (App Router) — UI, API routes, Telegram webhook
- TypeScript + Tailwind CSS
- Prisma + PostgreSQL
- Telegraf (webhook)
- OpenAI (mentions, welcomes, summaries)
- Viem + Hardhat (`smartContracts/`) — EmploymentContract on Celo Mainnet

## Local setup

```bash
pnpm install
cp .env.example .env
# Configure DATABASE_URL, TELEGRAM_BOT_TOKEN, OPENAI_API_KEY
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Point Telegram webhook to `POST /api/telegram`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model (default `gpt-4o-mini`) |
| `CELO_RPC` | Celo Mainnet RPC (default Forno) |
| `SENTRY_OPERATOR_KEY` | Operator key for on-chain charges |
| `SENTRY_OWNER_KEY` | Owner key for admin contract calls |
| `SENTRY_TREASURY_ADDRESS` | Treasury receiving charged funds |
| `CELO_USDM_ADDRESS` / `USDC` / `USDT` | ERC-20 token addresses on Celo |
| `ADMIN_EMAILS` | Comma-separated admin emails |

After contract deploy, run `pnpm contracts:sync` so `lib/contracts/` has the address.

## Telegram bot setup

1. Create a bot via [@BotFather](https://t.me/BotFather).
2. Set `TELEGRAM_BOT_TOKEN` in `.env`.
3. Set webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram`
4. Add the bot to a group and hire/enable Sentry in the dashboard.

Bot commands: `/start`, `/help`, `/mywallet`, `/balance`, `/deposit`

## Billing

- Prices are configured in `lib/pricing.ts` (amount + active currency).
- Billing flow: completed action → pending `ChargeRecord` → on-chain `charge()` → DB updated only after tx success.
- Failed on-chain charges leave the charge as `failed`/`pending` — user is not billed in the database.
- No `credit()` on the contract. Users fund via `depositNative()` / `depositERC20()` or direct transfer + **Sync Balance**.

## Celo Mainnet deployment

```bash
cd smartContracts
pnpm install
# Set PRIVATE_KEY, CELO_USDM_ADDRESS, etc. in smartContracts/.env
pnpm compile
pnpm deploy-celo
cd ..
pnpm contracts:sync
```

Set `SENTRY_OPERATOR_KEY` to the operator account used at deploy time.

## Demo guide (3 minutes)

1. Sign in at `/login`.
2. **Hire Sentry** at `/employment`.
3. Copy wallet address at `/wallet`, fund on Celo, click **Sync Balance**.
4. Add bot to a Telegram group.
5. Enable the group at `/groups`.
6. Mention `@sentry` in the group — Sentry replies.
7. Open `/dashboard` — see completed action and spend.
8. Verify on-chain charge on Celo explorer (if contract configured).
9. Wait for or trigger daily summary (scheduler / configured hour).

## Admin

`/admin/payment` — change global payment currency (requires `ADMIN_EMAILS`).

## Folder structure

```text
app/              pages + API routes
components/       UI
lib/              prisma, auth, pricing, payment-currency, identity, contracts
services/         billing, wallet, employment, AI, telegram, blockchain
telegram/         bot, commands, handlers
smartContracts/   EmploymentContract (Hardhat)
prisma/           schema + migrations
docs/             product + agent prompts
```

## Scripts

```bash
pnpm dev              # Next.js dev server
pnpm scheduler        # Background cron jobs
pnpm bot:poll         # Telegram long-polling (dev)
pnpm contracts:compile
pnpm contracts:sync
```
