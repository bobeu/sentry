# Sentry

An AI employee for Telegram that businesses and individuals hire to monitor conversations, represent them, moderate communities, and generate intelligent reports — charged from a prepaid on-chain wallet on Celo for completed work.

## Tech stack

- Next.js 15 (App Router) — UI, API routes, Telegram webhook
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Telegraf
- Viem
- Hardhat (`smartContracts/`) — EmploymentContract

## Folder structure

```text
app/              # pages + API route handlers
components/       # UI components
lib/              # prisma, auth, types, helpers, contract bindings
services/         # wallet, employment, blockchain, ai placeholders
telegram/         # bot, commands, handlers
smartContracts/   # EmploymentContract (Hardhat, separate package)
lib/contracts/    # synced ABI + addresses (via smartContracts/sync-data.js)
prisma/           # schema + migrations
public/           # static assets
docs/             # product + agent docs
8004_registration/  # ERC-8004 registration tooling
```

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Point `DATABASE_URL` at your PostgreSQL instance, then:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

4. Start the web app:

```bash
pnpm dev
```

5. Optional — Telegram bot (requires `TELEGRAM_BOT_TOKEN`):

```bash
pnpm bot:poll
```

6. Optional — smart contracts (deploy yourself):

```bash
cd smartContracts
pnpm install
pnpm compile
pnpm deploy-sepolia   # or deploy-celo
pnpm sync             # writes ABI/address into lib/contracts
```

## Prompt 2 flows

1. Sign in at `/login`
2. Create or connect a wallet at `/wallet`
3. Deposit prepaid funds (test USD values accepted via API)
4. Hire Sentry at `/employment`
5. Dashboard shows live employment status + balance

## Useful scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build |
| `pnpm prisma:migrate` | Create/apply migrations |
| `pnpm bot:poll` | Start Telegraf long polling |
| `pnpm contracts:compile` | Compile EmploymentContract |
| `pnpm contracts:sync` | Sync ABI/addresses into `lib/contracts` |
