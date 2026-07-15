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

# CTO Said

This is progressing well.

I also noticed something important in Prompt 2 that I'd **change before moving forward**.

---

# Fixes from Prompt 2

## ❌ Remove private key generation

This concerns me.

The summary says:

> `create wallet (returns private key once...)`

I don't want Sentry generating and exposing users' private keys.

For this hackathon, that's unnecessary and introduces security concerns.

Instead:

* User connects an existing wallet **or**
* User creates a smart wallet through the wallet provider you'll ultimately use.

Sentry should **never** become a wallet generator or custodian unless that's a core part of the product.

For now, abstract the wallet layer behind a `WalletProvider` interface so it can later be backed by a provider such as Para, Privy, Dynamic, or another smart-wallet solution without changing the rest of the codebase.

---

## ❌ Remove Sepolia

Everything should be Celo-only.

Remove Ethereum references.

Only support:

* Celo Mainnet

---

## ✅ Good decision

Separating

```
smartContracts/
```

from the app is exactly what I would have done.

Keep it.

---

# Prompt 3

This is where Sentry actually becomes an AI employee.

Do **not** implement billing yet.

The AI must first prove it can work.

---

# Prompt 3 — Telegram Employee Foundation

## Objective

Transform Sentry from a web application into a working Telegram AI Community Employee.

By the end of this prompt:

* Sentry can join Telegram groups.
* Users can hire Sentry for specific groups.
* Sentry understands the group's recent conversation.
* Sentry can answer mentions.
* Sentry can welcome members.
* Sentry can answer basic questions.

No billing.

No moderation.

No reports.

No scheduler.

No summaries.

---

# Telegram

Implement webhook mode.

Support

```text
/start

/help
```

plus

Group events.

---

When Sentry joins a group

Store

* Group ID
* Group Name
* Owner
* Member Count (if available)

---

# Employment

A user hires Sentry globally.

Then enables it

per group.

Example

```text
User

↓

Hire Sentry

↓

Add Sentry

↓

Enable

Group A

↓

Enable

Group B
```

Employment remains user-based.

Activation becomes group-based.

---

# Group Configuration

Each group has

```text
Enabled

Welcome Members

Reply To Mentions

Answer Questions
```

Nothing else.

---

# Context Engine

Implement a lightweight context engine.

No vector database.

No RAG.

No embeddings.

Only keep

```text
Pinned Messages

+

Group Description

+

Recent Messages

(last 100)

+

Group Configuration
```

Whenever AI generates a reply

Build the prompt from

those four inputs.

---

# Mention Detection

When

```text
@sentry
```

or

the bot is replied to

↓

Generate a response.

Do NOT answer every message.

Only respond when explicitly addressed.

---

# Welcome Messages

When a new member joins

↓

Generate a friendly welcome.

Use group context.

Keep it short.

---

# FAQ

Admins can save

up to

20

question/answer pairs.

Store them in the database.

Before using AI

Check FAQs first.

If matched

↓

Return FAQ answer.

Otherwise

↓

Call AI.

---

# AI Service

Implement

```typescript
generateReply()

generateWelcome()

answerFAQ()
```

Use OpenAI.

Prompt should always include

* Group Name
* Group Rules
* Recent Messages
* FAQs
* User Question

---

# Memory

Never remember forever.

Only use

recent messages.

No long-term memory.

---

# Database

Add

```text
GroupFAQ

ConversationContext
```

ConversationContext

should only store

recent messages.

Automatically delete old entries.

Cap at

100.

---

# Dashboard

Groups page

Display

```text
Telegram Groups

Enabled

Employment Status

Recent Activity

Messages Today
```

---

Clicking a group

opens

```text
Settings

Recent Messages

FAQs

Employment

```

---

# API

Implement

```text
POST /api/groups/enable

POST /api/groups/disable

POST /api/groups/faq

GET /api/groups

GET /api/groups/:id
```

---

# AI Rules

The AI must

Never

* invent rules
* pretend to be human
* answer outside context

If unsure

↓

Say

"I don't know."

---

# Excluded

Do NOT implement

* Billing
* Payment deductions
* Moderation
* Reports
* Scheduler
* Summaries
* Spam detection
* Analytics

---

# Acceptance Criteria

At the end of Prompt 3

✅ Sentry can join Telegram groups.

✅ Users can enable or disable Sentry per group.

✅ Sentry answers mentions.

✅ Sentry welcomes members.

✅ FAQ system works.

✅ AI uses recent conversation context.

✅ Dashboard displays connected groups.

---

## One important change I'd make

I would **not** store raw conversation history indefinitely in the database.

Instead:

* Store only a rolling window of the last **100 messages** (or fewer if the group is quiet).
* Delete the oldest messages as new ones arrive.
* Treat this as **working memory**, not permanent storage.

This keeps storage predictable, respects user privacy better, and gives the AI enough context to respond intelligently without accumulating an ever-growing message archive. For the MVP, that's the right balance between usefulness and simplicity.

---

# Prompt 3 Amendments

## Smart Wallet Architecture (Required)

Do **not** create or manage EOAs (Externally Owned Accounts) for users.

Sentry uses **Smart Contract Accounts (Smart Wallets)**.

The smart wallet is the user's internal employment wallet and is managed by the Employment smart contract.

### Wallet Requirements

* Every user owns exactly one Smart Wallet.
* The Smart Wallet is automatically created when the user hires Sentry for the first time.
* The wallet exists only for interacting with Sentry.
* Users do not manage private keys.
* Users only interact with their Smart Wallet through the Sentry application.
* The Smart Wallet stores the user's prepaid balance used to pay Sentry.
* All deductions are executed by the Employment smart contract.
* The application should expose only the wallet address and current balance to the user.

The architecture should resemble:

```text
User
    │
    ▼
Sentry Web App
    │
    ▼
Employment Smart Contract
    │
    ▼
User Smart Wallet (Contract Account)
```

The backend should never generate or return private keys.

Future wallet providers may be integrated later without changing the product architecture.

---

## Blockchain Network

Sentry targets **Celo Mainnet only**.

Do **not** implement support for:

* Celo Alfajores
* Celo Sepolia
* Ethereum Sepolia
* Ethereum Mainnet
* Any other EVM network

Every contract, deployment script, configuration file, RPC configuration, and blockchain service should assume **Celo Mainnet** as the only supported network.

Remove every reference to test networks from the project.

Deployment scripts, configuration, and documentation should all target Celo Mainnet exclusively.

This hackathon project will be developed, tested, and demonstrated entirely on Celo Mainnet.

---

# Agent Session Summary — Prompt 3 (2026-07-15)

## Prompt 2 fixes applied

- Removed EOA private-key generation and UI that displayed keys.
- Added `lib/wallet-provider.ts` (`WalletProvider` + `EmploymentContractWalletProvider`).
- Smart wallet is provisioned on Hire / ensure — address + balance only, no keys.
- Removed wallet connect/create-key flow; `/api/wallet/create` now only ensures the smart wallet.
- Celo **Mainnet only**: dropped Sepolia from Hardhat, sync-data, blockchain service, README, and env examples.

## Telegram employee foundation

- Webhook `POST /api/telegram` + `/start` `/help`.
- On bot join (`my_chat_member` / `new_chat_members`): store group id, name, owner, member count.
- User-level employment + per-group enable via `GroupEmployment` + `GroupSettings`.
- Group toggles: Enabled, Welcome Members, Reply To Mentions, Answer Questions.
- Rolling `ConversationContext` (last 100 messages, auto-prune).
- `GroupFAQ` (max 20); FAQ match before OpenAI.
- Mentions / replies to bot → `aiService.generateReply()`; new members → `generateWelcome()`.
- AI rules: no invented rules, no pretending to be human, say "I don't know." when unsure.

## APIs & UI

- `GET/PATCH /api/groups`, `GET /api/groups/:id`, `POST enable|disable`, `POST/DELETE faq`
- Pages: `/groups`, `/groups/[id]` (settings, FAQs, recent messages)
- Dashboard shows live enabled group count / tasks today

## Database

- Migration `20260715140000_prompt3_telegram`
- Models: `GroupSettings`, `GroupEmployment`, `GroupFAQ`, `ConversationContext`; expanded `TelegramGroup`; `Wallet.provider`

## Not run in this session

- `prisma migrate` requires local Postgres
- OpenAI / Telegram tokens must be set in `.env` for live replies
- EmploymentContract still user-deployed on Celo mainnet (`pnpm deploy-celo` + sync)

---

# CTO Said

This is progressing exactly the way I'd expect. The architecture is still clean, and I don't see any overengineering creeping in.

I only have **three small corrections** before Prompt 4.

---

# Fixes from Prompt 3

## 1. Don't store the last 100 raw messages forever

The summary says:

> Rolling ConversationContext (last 100 messages)

Keep this, but make it **ephemeral**.

Rules:

* Maximum 100 recent messages.
* Maximum retention: **24 hours**.
* Automatically delete anything older than 24 hours.
* This is working memory, **not** chat history.

This reduces storage, improves privacy, and keeps prompts relevant.

---

## 2. Dashboard should never show "Tasks Today"

At this point the system has no billing engine.

Replace

```text
Tasks Today
```

with

```text
Actions Completed
```

Later, billing will decide which actions are billable.

---

## 3. Group owner

Telegram doesn't reliably expose the group owner through normal bot events.

Instead, store:

* Group ID
* Group Name
* User who enabled Sentry
* Administrators (when obtainable)

Do not assume ownership information exists.

---

# Prompt 4 — Community Employee (Core Work Engine)

## Objective

This prompt turns Sentry into a **real AI Community Employee**.

By the end of this prompt, Sentry should be capable of performing useful work inside Telegram communities.

**This is the first prompt where Sentry actually earns money (logically), but do NOT implement blockchain deductions yet.** Instead, record billable actions in the database.

---

# Scope

Implement only these six jobs:

1. Reply to mentions
2. Welcome new members
3. Answer FAQs
4. Moderate spam
5. Summarize discussions
6. Notify users of important mentions

Nothing else.

---

# Community Moderation

Implement lightweight moderation.

Detect:

* obvious spam
* repeated messages
* scam links
* excessive emojis
* offensive language (AI-assisted)

Actions:

* Delete message (if bot has permission)
* Warn user
* Notify admins

Every moderation action becomes an **Action Record**.

---

# Discussion Summaries

Implement:

Daily Summary

Generate a concise summary containing:

* Important discussions
* Questions asked
* Decisions made
* Unanswered questions

Send to:

* Group
* Admins
* Private chat

according to group settings.

---

# Mention Notifications

If a monitored user is mentioned while away:

Notify them privately.

Example:

```text
You were mentioned in "Sentry Builders".

Summary:

John asked for the deployment link.

Alice replied with a partial answer.

Recommended action:
Reply when available.
```

---

# Action Records

Create a new model:

```text
ActionRecord
```

Purpose:

Track work completed by Sentry.

Fields:

```text
type

groupId

userId

completedAt

status

billable (boolean)

metadata
```

This is **not** billing.

It is a work log.

Future prompts will convert billable actions into payments.

---

# Scheduler

Implement the scheduler now.

Only five jobs:

* Daily summaries
* Daily reports
* Reminder notifications
* Conversation cleanup (delete messages older than 24 hours)
* Maintenance

Nothing more.

Use the simplest scheduler available.

---

# AI Improvements

Improve prompts.

Always include:

* Group name
* Group purpose
* Group rules
* Recent conversation
* FAQs
* User settings

Keep prompts concise.

Limit unnecessary tokens.

---

# Dashboard

Replace the placeholder dashboard.

Display:

```text
Wallet Balance

Employment Status

Connected Groups

Actions Completed

Today's Billable Actions

Recent Activity
```

Recent Activity:

```text
Answered Mention

Generated Summary

Moderated Spam

Sent Notification

Welcomed Member
```

---

# Group Dashboard

Display:

```text
Group Name

Employment Enabled

Actions Today

Mentions Handled

Spam Removed

Summary Status
```

---

# Group Settings

Expand settings.

Users can configure:

* Welcome message ON/OFF
* Mention replies ON/OFF
* FAQ ON/OFF
* Spam moderation ON/OFF
* Daily summary time
* Mention notifications ON/OFF

Nothing else.

---

# Billing Preparation

Do **not** deduct money yet.

Instead:

Every completed job creates an `ActionRecord`.

Mark whether it is billable.

Example:

```text
Reply → billable

Welcome → billable

Summary → billable

Spam moderation → billable

Notification → billable
```

No blockchain interaction in this prompt.

---

# API

Implement:

```text
GET /api/actions

GET /api/actions/recent

GET /api/groups/:id/actions

PATCH /api/groups/:id/settings
```

---

# Excluded

Do NOT implement:

* Smart contract deductions
* Wallet charging
* On-chain settlement
* Revenue dashboard
* Analytics
* Multi-user billing
* Payment streaming

These belong to Prompt 5.

---

# Acceptance Criteria

At the end of Prompt 4:

* ✅ Sentry actively works inside Telegram groups.
* ✅ It answers mentions.
* ✅ Welcomes members.
* ✅ Detects and moderates obvious spam.
* ✅ Generates daily summaries.
* ✅ Sends private mention notifications.
* ✅ Records every completed action in `ActionRecord`.
* ✅ Dashboard reflects real work completed.
* ✅ Conversation context is automatically cleaned after 24 hours.

---

## One architectural improvement

From this point onward, stop thinking in terms of **"tasks"** and start thinking in terms of **"completed work."**

Everything Sentry does should follow the same lifecycle:

```text
Event
    ↓
AI decides
    ↓
Work completed
    ↓
ActionRecord created
    ↓
(Next prompt)
Billing Engine charges
```

That separation is important because it keeps the AI focused on doing useful work while the payment system simply accounts for completed work. It also makes it easy to change pricing later without changing the AI behavior. I think this is the cleanest separation of concerns for the rest of the implementation.

---

# Agent Session Summary — Prompt 4 (2026-07-15)

## Prompt 3 fixes

- Conversation context is ephemeral: max **100** messages **and** max **24 hours** (prune on write + scheduler every 15m).
- Dashboard uses **Actions Completed** (not Tasks Today).
- Groups store **admins** (`adminTelegramIds`) + **enabledByUserId** via `GroupEmployment`; no assumed Telegram owner.

## Core work engine

- New `ActionRecord` model (`type`, `groupId`, `userId`, `completedAt`, `status`, `billable`, `metadata`).
- Jobs wired with ActionRecords (all billable when successful):
  - Mention replies / FAQ answers
  - Welcomes
  - Spam moderation (scam links, repeats, emoji spam, offensive; delete + warn + notify admins)
  - Daily summaries (group / admins / private per settings)
  - Private mention notifications for monitored Telegram usernames
- No on-chain deductions (billing prep only).

## Scheduler (`node-cron`)

Jobs: conversation cleanup, hourly daily-summary pass, daily reports log, reminders stub, weekly maintenance.  
Starts via `instrumentation.ts` and `pnpm scheduler`.

## APIs & UI

- `GET /api/actions`, `GET /api/actions/recent`, `GET /api/groups/:id/actions`, `PATCH /api/groups/:id/settings`
- Dashboard: wallet, employment, groups, actions completed, today's billable, recent activity feed
- Group dashboard stats + expanded settings (welcome, mentions, FAQ, spam, summary hour, mention notifications)
- User settings: Telegram username + user ID for DM alerts

## Migration

`prisma/migrations/20260715160000_prompt4_actions/` — run `pnpm prisma:migrate` when Postgres is up.

---

# CTO Said

This is excellent progress. The project is still very focused, which is exactly what we wanted.

After reviewing Prompt 4, I only want to make **two corrections** before moving into billing.

---

# Fixes from Prompt 4

## 1. Scheduler frequency

The summary says:

> hourly daily-summary pass

I would change this.

Instead:

* Daily Summary → run once at the configured hour.
* Conversation Cleanup → every 15 minutes.
* Reminder Jobs → every 15 minutes.
* Maintenance → once weekly.

There is no reason to wake the AI every hour just to check whether a summary should be generated.

---

## 2. Spam Moderation

I would make one small behavioral rule.

Sentry should **never delete a message immediately because the AI thinks it's spam.**

Instead:

```text
Spam Confidence

<70%

↓

Warn

70-90%

↓

Notify Admin

>90%

↓

Delete (only if bot has permission)
```

That prevents embarrassing false positives.

---

# Prompt 5 — Billing Engine & Smart Contract Integration

## Objective

This prompt introduces **AgentPay**, the financial layer behind Sentry.

By the end of this prompt:

* Every completed ActionRecord can be billed.
* User balances decrease automatically.
* Employment pauses automatically when balance reaches zero.
* The dashboard shows spending in real time.

No new Telegram features should be added.

---

# Core Principle

Sentry charges **only for completed work.**

It never charges for:

* Reading messages
* Waiting
* Thinking
* AI processing

Only successful work.

---

# Billing Flow

```text
Telegram Event
        │
        ▼
AI completes work
        │
        ▼
ActionRecord
        │
        ▼
Billing Engine
        │
        ▼
Employment Contract
        │
        ▼
Wallet Balance Updated
```

---

# Smart Contract

Complete `EmploymentContract.sol`.

Implement:

```solidity
charge()

pause()

resume()
```

Requirements:

* Only the Sentry service wallet can call `charge()`.
* Reject charges larger than the available balance.
* Automatically mark employment as exhausted when balance reaches zero.
* Emit events for every deposit, withdrawal, charge, pause, and resume.

No staking.

No yield.

No escrow.

No subscriptions.

Keep the contract intentionally small.

---

# Billing Engine

Implement:

```text
calculateCharge()

chargeUser()

refund()

getPricing()
```

Pricing should come from configuration, not hardcoded values.

---

# Initial Pricing

Store prices centrally.

Example:

```text
Mention Reply           0.01 cUSD

FAQ Answer              0.005 cUSD

Welcome                 0.005 cUSD

Summary                 0.05 cUSD

Spam Moderation         0.02 cUSD

Mention Notification    0.01 cUSD
```

Easy to modify later.

---

# Billing Rules

Only bill when:

```text
ActionRecord.status == COMPLETED

AND

billable == true
```

If AI fails

↓

No charge.

---

# Automatic Exhaustion

When balance reaches zero:

```text
Employment

↓

Exhausted

↓

Disable all Groups

↓

Ignore future work

↓

Notify User
```

Do not continue working.

---

# Resume

When the user deposits funds:

```text
Exhausted

↓

Deposit

↓

Resume

↓

Employment Active

↓

Previously enabled groups reactivate automatically
```

---

# Dashboard

Replace "Today's Billable Actions" with:

```text
Today's Spend

Current Balance

Estimated Remaining Actions
```

Estimated Remaining Actions should be based on the average action cost.

---

# Wallet Page

Display:

```text
Balance

Today's Spend

Lifetime Spend

Deposit

Withdraw

Recent Charges
```

Recent Charges:

```text
Reply to Mention

-0.01

Daily Summary

-0.05

Spam Moderation

-0.02
```

---

# Pricing Page

New page:

```text
Reply to Mention

0.01

Summary

0.05

Welcome

0.005
```

Read-only.

No editing.

---

# Database

Add:

```text
ChargeRecord
```

Fields:

```text
ActionRecord

Amount

Status

TransactionHash

CreatedAt
```

Each ActionRecord may have one ChargeRecord.

---

# APIs

Implement:

```text
GET /api/billing/pricing

GET /api/billing/history

GET /api/billing/spending

POST /api/wallet/deposit

POST /api/wallet/withdraw
```

---

# Notifications

Notify users when:

* Balance below 20%.
* Employment exhausted.
* Deposit successful.
* Withdrawal successful.

---

# Dashboard Visualization

Use a simple spending graph.

```text
$25.00

█████████████

↓

$24.98

↓

$24.94

↓

$24.89
```

Keep it lightweight.

No complex chart library is necessary.

---

# Security

The backend must:

* Validate every ActionRecord before charging.
* Prevent duplicate billing.
* Ignore failed actions.
* Prevent negative balances.
* Reject unauthorized charge requests.

---

# Excluded

Do **not** implement:

* Revenue analytics
* Multiple pricing plans
* Referral rewards
* Discount codes
* Subscriptions
* Marketplace
* Multi-currency support

Stay focused.

---

# Acceptance Criteria

At the end of Prompt 5:

* ✅ Every completed ActionRecord results in one charge.
* ✅ The Employment smart contract updates balances correctly.
* ✅ Balances decrease after completed work.
* ✅ Employment automatically pauses when funds are exhausted.
* ✅ Depositing funds resumes employment.
* ✅ Groups reactivate automatically after resume.
* ✅ Users can view spending history and recent charges.
* ✅ Dashboard reflects real wallet balances and spending.

---

## One final improvement before implementation

I would make one significant simplification compared to our earlier discussions.

**Do not implement streaming payments anymore.**

Originally, AgentPay Stream was based on continuous value streaming. But Sentry has naturally evolved into a **pay-per-completed-work** product. That model is much easier for users to understand ("I pay when Sentry does something useful"), much simpler to implement, and a better fit for the Telegram workflow.

You can still market the underlying technology as inspired by AgentPay Stream, but the MVP should bill discretely per completed action rather than trying to stream value continuously. It keeps the smart contract small, the billing logic straightforward, and the demo much stronger.

---

# Agent Session Summary — Prompt 5 (2026-07-15)

## Prompt 4 fixes

- **Scheduler:** Daily summary still ticks hourly but only runs groups whose `dailySummaryHour` matches (once per group per day). Cleanup every 15m. Reminders every 15m. Maintenance weekly (Sun 03:00 UTC). Removed the redundant daily-report hourly wake.
- **Spam tiers:** `<70%` warn only · `70–90%` warn + notify admins · `>90%` delete only if bot has permission (else warn). Never deletes on weak confidence.

## Billing (pay-per-completed-work — no streaming)

- `lib/pricing.ts` — central cUSD prices + labels (`getPricing`, `priceFor`, `averageActionCost`).
- `services/billing.service.ts` — `calculateCharge`, `chargeUser`, `refund`, `getPricing`, `getSpending`, `getHistory`, exhaustion + deposit resume.
- `ActionService.record` charges exactly once after completed billable actions (duplicate-safe via 1:1 `ChargeRecord`).
- Failed actions / non-billable → no charge. Insufficient balance → failed charge + Exhausted.

## Smart contract

- `EmploymentContract.sol` complete: `deposit` / `credit` / `withdraw` / `charge` / `pause` / `resume` + events (`Deposited`, `Withdrawn`, `Charged`, `Paused`, `Resumed`, `Exhausted`). Operator-only `charge`. Exhausts + pauses at zero.
- `blockchain.service.ts` — optional on-chain `charge` / `pause` / `resume` / `credit` via `SENTRY_OPERATOR_KEY` when contract address is synced.

## Exhaustion / resume

- Balance → 0: Employment `Exhausted`, disable group settings for enabled employments, stop work, notify.
- Deposit while Exhausted/Inactive: Active + previously enabled groups reactivate; notify success.
- Withdraw + notify; withdraw-to-zero exhausts.

## Database

- `ChargeRecord` (`actionRecordId` unique, `amount`, `status`, `transactionHash`, `createdAt`).
- Migration: `prisma/migrations/20260715180000_prompt5_billing/`.

## APIs & UI

- `GET /api/billing/pricing|history|spending`
- `POST /api/wallet/deposit|withdraw`
- Dashboard: Today's Spend, Current Balance, Estimated Remaining Actions + ASCII 7-day spend bars (15s refresh).
- Wallet: balance, today/lifetime spend, deposit/withdraw, recent charges.
- Read-only `/pricing` page + nav link.

## Ops

- Run `pnpm prisma:migrate` (or `prisma:deploy`) when Postgres is available.
- Sync contract after deploy: `pnpm contracts:sync`. Set `SENTRY_OPERATOR_KEY` for on-chain charges.
- DB ledger is always updated; on-chain charge is best-effort when operator key + address exist.

