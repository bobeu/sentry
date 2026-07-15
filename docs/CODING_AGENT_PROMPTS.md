# Prompt 1 — Project Foundation

## Objective

Build the complete project foundation for **Sentry**, an AI Telegram Community Employee.

This prompt only establishes the architecture, project structure, development environment, shared libraries, database, authentication, and frontend shell. **Do not implement AI logic, Telegram features, billing, smart contracts, or dashboards yet.**

The project must remain **simple**, modular, and easy to extend throughout the hackathon.

---

## Project Overview

Sentry is an AI Community Employee for Telegram.

Users hire Sentry to work inside Telegram communities.

Sentry can:

- Monitor conversations
- Answer mentions
- Welcome new members
- Moderate spam
- Summarize discussions
- Generate reports

Users pre-fund a blockchain wallet.

As Sentry completes work, users are charged.

When funds reach zero, Sentry stops working.

This prompt should **not** implement any of those features yet.

---

# Tech Stack

Use:

### Frontend

- Next.js 15+
- TypeScript
- TailwindCSS
- shadcn/ui

---

### Backend

- NestJS
- Prisma
- PostgreSQL

---

### Telegram

- Telegraf

---

### Blockchain

- Celo
- Viem

(No smart contract implementation yet.)

---

### AI

Leave placeholder service only.

---

# Repository Structure

Create the following monorepo:

```text
sentry/

apps/
    web/
    api/
    bot/

packages/
    shared/
    ui/

contracts/

docs/

.env.example

pnpm-workspace.yaml
package.json
README.md

```

Use **pnpm workspaces**.

---

# Backend

Create a NestJS project.

Configure:

- Prisma
- PostgreSQL connection
- ConfigModule
- ValidationPipe
- Global exception filter
- Health endpoint

Create modules only:

```text
AuthModule

UsersModule

WalletModule

GroupsModule

BillingModule

TelegramModule

AiModule

```

Only module skeletons.

No business logic.

---

# Database

Configure Prisma.

Create initial models only.

```text
User

Wallet

TelegramGroup

Employment

Task

BillingRecord

Report

Settings

```

Only fields necessary for identification and relationships.

Do **not** over-design.

Generate migration.

---

# Frontend

Create a modern landing page.

Navigation:

- Home
- Dashboard
- Documentation

Dashboard page should contain placeholders only.

Cards:

```text
Wallet Balance

Employment Status

Tasks Completed

Groups Connected

```

Populate with mock data.

---

# Authentication

Implement wallet-less authentication for now.

Simple email login.

Authentication should be replaceable later.

---

# Shared Package

Create:

```text
types/

constants/

helpers/

```

Move shared types there.

---

# Telegram Bot

Create Telegraf application.

Only implement:

```text
/start

/help

```

Commands.

Return static messages.

No AI.

No database.

---

# AI Service

Create placeholder service only.

```typescript
generateReply()

summarize()

moderate()

answerMention()

```

Each should throw:

```text
Not Implemented

```

---

# Blockchain

Create blockchain service.

Implement only:

```text
connect()

getBalance()


```

Return mock values.

No contract deployment.

---

# Environment Variables

Prepare:

```text
DATABASE_URL=

OPENAI_API_KEY=

TELEGRAM_BOT_TOKEN=

CELO_RPC=

NEXT_PUBLIC_API_URL=

```

---

# Documentation

Update README.

Include:

- What is Sentry
- Tech stack
- Local setup
- Folder structure

---

# Coding Rules

- TypeScript strict mode.
- ESLint.
- Prettier.
- No duplicated code.
- Small reusable components.
- Dependency injection everywhere.
- No hardcoded secrets.
- No TODO comments.

---

# Deliverables

At the end of this prompt the project should:

✅ Compile successfully.

✅ Backend runs.

✅ Frontend runs.

✅ Telegram bot starts.

✅ PostgreSQL connected.

✅ Prisma migrated.

✅ Docker starts.

✅ Landing page visible.

✅ Dashboard placeholders visible.

✅ README completed.

---

# Do NOT Implement

- AI logic
- Billing
- Smart contracts
- Telegram monitoring
- Summaries
- Reports
- Moderation
- Wallet generation
- Payment deductions
- Scheduler

Those belong to later prompts.

---

## Success Criteria

By the end of Prompt 1, we should have a clean, running monorepo with the foundational services, database schema, UI shell, and Telegram bot scaffold in place. Every application should start without errors, and the repository should be ready for Prompt 2, where we'll implement the smart contract and the core employment/payment model.

---

# Sentry Refactor – Simplify the Architecture

## Objective

Refactor the current project into a simple hackathon-friendly architecture. Remove unnecessary complexity while preserving existing work where possible.

The goal is **not** to build an enterprise backend. The goal is to ship a polished MVP quickly.

---

## New Architecture

Use a **single Next.js application** as the primary application.

The project should become:

```text
sentry/

app/
components/
lib/
services/
telegram/
contracts/
prisma/
public/
docs/
```

Remove the separate NestJS backend entirely.

The Next.js application should provide:

* Web UI
* API Routes
* Telegram Webhook endpoint
* AI Services
* Blockchain Services
* Billing Services
* Scheduler

Everything should live inside one application.

---

## Remove

Remove the following completely:

* NestJS
* Controllers
* Modules
* Dependency Injection
* Global Filters
* Validation Pipes
* Docker
* Docker Compose
* Redis
* BullMQ

Delete any code that only exists because NestJS required it.

---

## Keep

Preserve and migrate the following:

* Prisma
* PostgreSQL
* Existing database models
* Shared TypeScript types
* Telegram bot logic
* Environment configuration
* UI work
* Wallet service
* Blockchain service
* AI placeholder service

Do not rewrite these unless necessary.

---

## Services

Create plain TypeScript services instead of NestJS modules.

```text
services/

ai.service.ts

billing.service.ts

telegram.service.ts

wallet.service.ts

blockchain.service.ts

report.service.ts

scheduler.service.ts
```

Each service should export a class or simple functions.

No decorators.

No dependency injection.

No framework-specific abstractions.

---

## API

Move backend functionality into Next.js Route Handlers.

Example:

```text
app/api/

telegram/

wallet/

billing/

reports/

settings/
```

Keep handlers thin.

Business logic belongs inside the services folder.

---

## Scheduler

Use simple cron scheduling.

Only support:

* Daily summaries
* Daily reports
* Reminder jobs
* Billing reconciliation
* Maintenance tasks

Nothing else.

---

## Telegram

Move Telegram initialization into:

```text
telegram/

bot.ts

commands.ts

handlers.ts
```

The bot should continue to support:

* /start
* /help

No additional functionality yet.

---

## Blockchain

Keep the blockchain layer lightweight.

```text
services/blockchain.service.ts
```

Expose only:

* connect()
* getBalance()

Leave payment implementation for a later milestone.

---

## Coding Principles

Follow these rules throughout the refactor:

* Simplicity over abstraction.
* One responsibility per service.
* No unnecessary interfaces.
* No repository pattern.
* No CQRS.
* No event bus.
* No microservices.
* No premature optimization.
* Keep files small and readable.

---

## Acceptance Criteria

The refactor is complete when:

* The project runs as a single Next.js application.
* Prisma works normally.
* PostgreSQL connects successfully.
* Telegram bot starts successfully.
* Existing UI continues to work.
* API routes replace the NestJS backend.
* All unnecessary infrastructure has been removed.
* No functionality is lost during the migration.

Do not add new features during this refactor. Focus only on simplifying the architecture while preserving the existing foundation.

---

# Agent Session Summary (2026-07-14 → 2026-07-15)

## Hackathon registration (Celo DeFAI)

- Registered **Sentry** for **Agentic Payments and DeFAI** (`agentic-payments-defai`) via Celo Builders.
- Connected builder account (Isaac J / Bobman) and saved an early draft submission.
- Attribution tag assigned: `celo_e3cc4c8d8a0e` (from `github.com/bobeu/sentry`).
- Tracks selected: `most-revenue-generated`, `askbots`, `track-4-tba`.
- Added Twitter/X registration post: `https://x.com/Bobman7000/status/2077086116017033727`.
- Agent wallet on file: `0xa1f70ffA4322E3609dD905b41f17Bf3913366bC1`.
- Submission remains **draft** (not published).

## ERC-8004 identity

- Built a Bun registration script (later kept under `8004_registration/`) with Sentry metadata, Celo mainnet Identity Registry, and attribution tagging via `ox/erc8021`.
- Fixed TypeScript issues around event `agentId` parsing (topic-based extraction).
- On-chain registration succeeded:
  - Agent ID: **9680**
  - 8004scan: `https://8004scan.io/agents/celo/9680`
  - Tx: `https://celoscan.io/tx/0x9c2db680f269a1756704230d0dd6d8645ad169615d4155903520edecb906d6e9`
- Updated the DeFAI draft with `erc8004Url` and `celoNetwork: celo-mainnet`.

## Prompt 1 foundation (partial / redirected)

- Began executing **Prompt 1 — Project Foundation** from this file.
- User constraints applied mid-run:
  - **Do not build Docker**
  - **Stop scaffolding NestJS**
- NestJS API scaffolding was cancelled before completion.
- Next.js / monorepo install attempts were interrupted or cleaned up (`web-tmp` removed; some `pnpm install` runs aborted).
- Prompt 1 deliverables (full monorepo with NestJS `apps/api`, separate `apps/web` + `apps/bot`, Docker) were **not completed** as originally written.
- Architecture direction was updated in this document to a **single Next.js app** (no NestJS, no Docker). That refactor prompt is the current source of truth for the next implementation pass.

## Outstanding for later

- Finish / align the single-Next.js foundation (UI shell, Prisma, Telegram `/start` + `/help`, placeholder services).
- Complete DeFAI submission fields still missing for publish (tagline, description, Aigora Track 4 URLs if competing there).
- Telegram bot username / public API URL still pending for ERC-8004 metadata update.

---

# CTO Said:

# Prompt 2 — Smart Wallet & Employment System

## Objective

Implement the **core employment model** of Sentry.

At the end of this prompt, a user should be able to:

1. Sign in.
2. Connect or create a wallet.
3. Hire Sentry.
4. Deposit funds.
5. See their balance.
6. Activate or deactivate Sentry.

**Do not implement Telegram monitoring or AI features yet.**

Those belong in later prompts.

---

# Context

Sentry is an AI Telegram Community Employee.

Users **hire** Sentry.

Hiring means:

* employment becomes Active
* user deposits funds
* Sentry is allowed to work

No funds

↓

No work.

---

# Important

Do NOT create another ERC-8004 identity.

The Sentry agent identity already exists on-chain.

Reuse it.

Do NOT modify the hackathon registration.

---

# Wallet

Every user owns one wallet.

If they already have a wallet

↓

connect it.

Otherwise

↓

generate a smart wallet.

Persist it in the database.

Each wallet belongs to exactly one user.

---

# Employment

Create the Employment lifecycle.

States:

```text
Inactive

Active

Paused

Exhausted
```

Rules

Inactive

↓

User deposits

↓

Active

Active

↓

Balance becomes zero

↓

Exhausted

Active

↓

User pauses

↓

Paused

Paused

↓

Resume

↓

Active

---

# Smart Contract

Implement the first version of

EmploymentContract.sol

Purpose

Maintain prepaid balances.

Functions

```solidity
deposit()

withdraw()

balanceOf()
```

Leave placeholders for

```solidity
charge()

pause()

resume()
```

Do not implement billing yet.

Keep the contract intentionally small.

---

# Backend Services

Implement:

Wallet Service

Responsibilities

* Create wallet
* Connect wallet
* Get balance

Employment Service

Responsibilities

* Hire Sentry
* Pause employment
* Resume employment
* Get employment status

No billing logic.

---

# Dashboard

Replace placeholder cards with live data.

Display

```text
Employment

🟢 Active

Wallet

$25.42

Groups

0

Tasks

0
```

No mock values.

---

# Deposit Flow

Implement

```text
User

↓

Deposit

↓

Blockchain

↓

Database updated

↓

Dashboard updates
```

Use test values if necessary.

Do not deduct funds yet.

---

# Settings Page

Create a settings page.

Only implement

General

* Display Name
* Time Zone

Employment

* Auto Resume

Notifications

* Email Notifications

Leave every Telegram option for Prompt 4.

---

# API

Create endpoints

```text
POST /api/wallet/create

POST /api/wallet/connect

POST /api/employment/start

POST /api/employment/pause

POST /api/employment/resume

GET /api/employment/status

GET /api/wallet/balance
```

Keep responses simple.

---

# UI

Employment page

Button

```text
Hire Sentry
```

After hiring

↓

Show

```text
Employment Active
```

Wallet page

Show

* Wallet Address
* Balance
* Deposit button

No transaction history yet.

---

# Database

Update models if required.

Employment

Add

```text
status

startedAt

pausedAt
```

Wallet

Add

```text
address

balance
```

Do not introduce unnecessary tables.

---

# Excluded

Do NOT implement

* Telegram monitoring
* AI replies
* Summaries
* Moderation
* Scheduler
* Billing deductions
* Reports
* Group management

Those are future prompts.

---

# Acceptance Criteria

By the end of Prompt 2:

* Users can sign in.
* Users can create or connect a wallet.
* The employment lifecycle (Inactive, Active, Paused, Exhausted) is implemented.
* Users can hire Sentry.
* Users can deposit funds into their employment balance.
* Wallet balance is displayed in the dashboard.
* Employment status updates correctly.
* The first version of `EmploymentContract.sol` will be deployed locally or to Celo sepolia for testing. Do not worry about deployment. I will perform the deployment manually.
* Separate the smart contract directory from other services. To understand how to properly setup the contract, use the exact structure in `proofOfShip/vibecheck/smartContracts` including the script that sync contract data to the frontend.
* All functionality is wired through the simplified Next.js architecture with no NestJS dependencies.

---

## One architectural change I'd make before coding Prompt 2

I would **not generate a smart contract wallet automatically** for every new user.

Instead:

* If the user already has a compatible wallet, let them connect it.
* If they don't, provide a **"Create Wallet"** action.

This reduces friction during onboarding and avoids creating wallets for users who may never activate Sentry.

More importantly, it aligns with the product model: **employment begins when the user explicitly hires Sentry**, not merely when they create an account. That makes the onboarding flow much easier for judges to understand during your demo.

---

# Agent Session Summary — Prompt 2 (2026-07-15)

## Implemented

### Database (Prisma)
- Added `EmploymentStatus` enum: `Inactive | Active | Paused | Exhausted`.
- `Employment` is now **1:1 with User** (group no longer required for hiring).
- Fields: `status`, `startedAt`, `pausedAt`.
- `Wallet`: required `address` + `balance` (Decimal).
- `Session` model for cookie-based email auth.
- `Settings`: `displayName`, `timeZone`, `autoResume`, `emailNotifications`.
- Migration: `prisma/migrations/20260715120000_prompt2_employment/`.
- `prisma generate` succeeded. `migrate deploy` needs a running PostgreSQL at `DATABASE_URL`.

### Smart contracts (`smartContracts/` — vibecheck-style, separate package)
- `contracts/EmploymentContract.sol` with `deposit()`, `withdraw()`, `balanceOf()`, and placeholders `charge()` / `pause()` / `resume()`.
- Hardhat config (Celo + Sepolia), `deploy/01_deploy_employment.ts`, `sync-data.js` → writes `lib/contracts/{addresses,abis,index}`.
- User deploys manually (`pnpm deploy-sepolia` / `deploy-celo`), then `pnpm sync`.
- Hardhat dependency install may need a retry if the registry flakes; compile after `pnpm install` inside `smartContracts/`.

### Services
- `wallet.service.ts`: create wallet (returns private key once, not stored), connect wallet, get balance, record deposit.
- `employment.service.ts`: start/hire, pause, resume, status (auto-Exhausted when balance is 0).
- `blockchain.service.ts`: connect + optional on-chain `balanceOf` when contract address is synced.

### API routes
- `POST /api/auth/login` (sets httpOnly session cookie), logout, me
- `POST /api/wallet/create|connect|deposit`
- `GET /api/wallet/balance`
- `POST /api/employment/start|pause|resume`
- `GET /api/employment/status`
- `GET|PUT /api/settings`

### UI
- `/login`, `/dashboard` (live cards), `/employment` (Hire / Pause / Resume), `/wallet` (create/connect/deposit), `/settings`
- Nav updated. No NestJS.

## Not done / blocked
- PostgreSQL was not reachable at `localhost:5432` during this session — run migrations when DB is up.
- Hardhat `pnpm install` hit npm `ECONNRESET`; re-run install + compile locally before deploying.
- On-chain deposit UI still uses test USD amounts via API until you deploy and sync the contract.

## How to verify
1. Start Postgres, then `pnpm prisma:migrate`
2. `pnpm dev` → sign in → create/connect wallet → deposit → Hire Sentry
3. `cd smartContracts && pnpm install && pnpm compile && pnpm deploy-sepolia && pnpm sync`

---

