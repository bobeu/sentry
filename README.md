# Sentry

An AI employee for Telegram that businesses and individuals hire to monitor conversations, represent them, moderate communities, and generate intelligent reports — charged from a prepaid on-chain wallet on **Celo Mainnet** for completed work.

## Tech stack

- Next.js 15 (App Router) — UI, API routes, Telegram webhook
- TypeScript + Tailwind CSS
- Prisma + PostgreSQL
- Telegraf (webhook)
- OpenAI (mentions, welcomes, FAQ fallback)
- Viem + Hardhat (`smartContracts/`) — EmploymentContract on Celo Mainnet only

## Folder structure

```text
app/              # pages + API route handlers
components/       # UI components
lib/              # prisma, auth, wallet-provider, contract bindings
services/         # wallet, employment, groups, context, FAQ, AI
telegram/         # bot, commands, handlers
smartContracts/   # EmploymentContract (Hardhat, Celo mainnet)
prisma/           # schema + migrations
docs/             # product + agent docs
8004_registration/
```

## Local setup

```bash
pnpm install
cp .env.example .env
# set DATABASE_URL, TELEGRAM_BOT_TOKEN, OPENAI_API_KEY
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Point Telegram webhook to `POST /api/telegram`.

## Flows

1. Sign in → Hire Sentry (provisions smart wallet, no private keys)
2. Deposit prepaid funds
3. Add bot to a Telegram group
4. Enable the group on `/groups`
5. Mention the bot / reply to it — Sentry answers with FAQ + context

## Contracts (Celo Mainnet only)

```bash
cd smartContracts
pnpm install
pnpm compile
pnpm deploy-celo
pnpm sync
```
