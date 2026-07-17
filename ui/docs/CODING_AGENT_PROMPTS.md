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

---

# CTO Said

This is in very good shape.

More importantly, I think we've now reached **feature completeness for the MVP**.

From this point onward, we should **stop adding features** and focus on making Sentry feel like a polished product.

I only have **two fixes** from Prompt 5.

---

# Fixes from Prompt 5

## 1. Remove `credit()`

The summary says:

```solidity
deposit()

credit()

withdraw()
```

I don't think `credit()` belongs in the contract.

The contract should expose only user-facing financial operations.

Use:

```solidity
deposit()
withdraw()
charge()
pause()
resume()
balanceOf()
```

If the backend needs to increase a balance, it should simply call `deposit()`.

Keeping the contract API minimal makes auditing easier.

---

## 2. On-chain charging

The summary says:

> on-chain charge is best-effort

I don't like that wording.

Sentry's financial state should never diverge.

The rule should be:

```text
Smart Contract
        │
        ▼
Success
        │
        ▼
Update Database
```

Never:

```text
Database Updated

↓

Try Blockchain Later
```

The blockchain is the source of truth.

If an on-chain charge fails,

↓

the ActionRecord should remain

```text
PendingCharge
```

and the user should **not** be billed.

---

# Prompt 6 — Product Polish, Reliability & Hackathon Readiness

## Objective

Do **not** introduce new features.

This prompt is about making Sentry production-quality for the hackathon demo.

Focus on:

* reliability
* UX
* stability
* error handling
* observability
* documentation

---

# AI Reliability

Improve prompts.

Rules:

* Short responses.
* Never fabricate information.
* Always respect group rules.
* Never answer outside available context.
* If uncertain:

```text
I don't know based on the available context.
```

Limit responses to approximately:

* Mention replies → 2–5 sentences
* Welcome → 1–2 sentences
* Summaries → 5–10 bullet points

---

# Telegram Reliability

Handle:

* Bot removed from group
* Bot loses admin permission
* Group renamed
* Bot blocked by user
* Failed message delivery

Update database state accordingly.

Do not repeatedly retry failed operations.

---

# Smart Contract Reliability

Update the billing flow.

Correct flow:

```text
Action Completed
        │
        ▼
Create Pending Charge
        │
        ▼
Blockchain charge()
        │
        ├──────────────┐
        │              │
        ▼              ▼
Success          Failure
        │              │
        ▼              ▼
Complete      PendingCharge
```

Never reduce balances in the database before a successful on-chain charge.

The blockchain remains the source of truth.

---

# Error Handling

Every service should return clear errors.

Examples:

* Employment inactive
* Wallet not funded
* Bot not enabled
* AI unavailable
* Blockchain unavailable
* Telegram API unavailable

Avoid generic "Internal Server Error" messages where possible.

---

# Dashboard Polish

The dashboard should answer these questions immediately:

### Employment

```text
Status

Active
```

---

### Wallet

```text
Current Balance

Today's Spend

Lifetime Spend
```

---

### Communities

```text
Groups Connected

Groups Enabled

Actions Completed Today
```

---

### Recent Activity

Example:

```text
09:21

Answered mention

09:24

Welcomed member

09:40

Generated summary

09:46

Spam removed
```

Newest first.

---

# Group Dashboard

Display:

```text
Employment

Enabled

Today's Actions

Today's Spend

Last Summary

Recent Mentions

Moderation Events
```

No unnecessary charts.

---

# Notifications

Implement clear notifications for:

* Employment exhausted
* Low balance
* Deposit successful
* Withdrawal successful
* Smart contract charge failed
* Telegram permission lost

---

# Logging

Log only important events.

Examples:

```text
Employment Started

Employment Paused

Charge Completed

Charge Failed

Bot Joined Group

Bot Removed

Summary Generated
```

Do not log every incoming message.

---

# Security

Review the project for:

* Missing authentication
* Unauthorized API access
* Missing ownership checks
* Duplicate billing
* Replay of ActionRecords
* Invalid group configuration updates

Fix any issues found.

---

# Documentation

Update the README with:

* Project overview
* Local setup
* Environment variables
* Deployment
* Celo Mainnet deployment
* Telegram bot setup
* How billing works
* Demo guide

---

# Demo Flow

Prepare a smooth 3-minute demo.

Suggested sequence:

1. User signs in.
2. Hire Sentry.
3. Deposit cUSD.
4. Add Sentry to a Telegram group.
5. Enable Sentry for the group.
6. Mention Sentry.
7. Sentry replies.
8. Dashboard updates with a completed action.
9. On-chain charge succeeds.
10. Wallet balance decreases.
11. Show transaction on Celo.
12. Generate a daily summary.

Everything should happen without manual database edits.

---

# Final Acceptance Criteria

Sentry should now be able to:

* ✅ Be hired by a user.
* ✅ Create a Smart Contract Account for that user.
* ✅ Accept deposits.
* ✅ Join Telegram groups.
* ✅ Respond to mentions.
* ✅ Welcome members.
* ✅ Answer FAQs.
* ✅ Moderate spam using confidence thresholds.
* ✅ Generate daily summaries.
* ✅ Notify monitored users.
* ✅ Record completed work.
* ✅ Charge only after successful completed work.
* ✅ Settle charges on Celo Mainnet.
* ✅ Pause automatically when funds are exhausted.
* ✅ Resume after a successful deposit.
* ✅ Present a polished dashboard suitable for a live hackathon demonstration.

---

## Stop here

After Prompt 6, I **do not recommend adding more functionality**.

At this point, your highest return on time is:

* polishing prompts,
* improving AI response quality,
* reducing latency,
* making the UI feel premium,
* testing edge cases,
* and rehearsing the demo.

Those improvements will have a much greater impact on judges than adding another feature. A polished, reliable Sentry with one clear purpose is much more likely to stand out than a larger product with unfinished capabilities.

---

I **strongly agree** with this change.

In fact, I think it makes Sentry significantly more aligned with the Celo ecosystem. Celo is pushing stablecoin adoption, not just CELO. Supporting **CELO, USDm, USDC, and USDT** makes Sentry feel like a native Celo application.

I would, however, implement it slightly differently.

---

# Revised Payment Architecture

Instead of hardcoding a payment token into the contract, make the contract **currency-aware**.

## Supported Tokens

```text
CELO (Native)

USDm

USDC

USDT
```

Only these four.

No arbitrary ERC20 support.

---

# Contract Changes

Replace the current payment logic with a configurable payment asset.

## State

```solidity
enum PaymentToken {
    CELO,
    USDm,
    USDC,
    USDT
}

PaymentToken public activePaymentToken;
```

Store the token addresses internally.

```solidity
mapping(PaymentToken => address) public supportedTokens;
```

Initialize them in the constructor.

---

## Admin Functions

```solidity
setActivePaymentToken()

setSupportedTokenAddress()
```

Only Owner/Admin.

The active token determines:

* deposits
* withdrawals
* charges

Everything uses the currently selected token.

---

## Deposit

Instead of

```solidity
deposit()
```

support

```text
depositNative()

depositERC20()
```

Rules:

If

```text
activePaymentToken == CELO
```

↓

Accept native CELO only.

Otherwise

↓

Accept only the configured ERC20.

Reject everything else.

---

## Withdraw

Withdraw in the currently active currency.

No conversions.

---

## Charge

Charge using the currently active currency.

No exchange-rate calculations.

---

# Frontend Changes

Wallet Page

Instead of

```text
Wallet Balance

25
```

Display

```text
Wallet Balance

25 USDm
```

or

```text
3.2 CELO
```

depending on the active token.

---

Deposit Dialog

If active token is

CELO

↓

Show

```text
Deposit CELO
```

If

USDm

↓

Show

```text
Deposit USDm
```

etc.

---

Pricing Page

Instead of

```text
Reply

0.01
```

Display

```text
Reply

0.01 USDm
```

Always display the active currency.

---

Dashboard

Add a small badge.

Example

```text
Payment Currency

USDm
```

or

```text
Payment Currency

CELO
```

No dropdown for users.

---

# Admin Dashboard

Create one simple settings page.

```
Payment Currency

○ CELO

● USDm

○ USDC

○ USDT

[ Save ]
```

Changing this updates the smart contract.

Only administrators can access this page.

---

# Backend

Billing Service

Should never hardcode

```typescript
0.01
```

Instead

```typescript
price

+

currency
```

Example

```typescript
{
    amount: 0.01,
    currency: "USDm"
}
```

---

ChargeRecord

Add

```text
currency
```

Field.

Example

```text
Reply

0.01

USDm
```

---

Wallet

Add

```text
activeCurrency
```

to the wallet model (or retrieve it directly from the contract if you want the blockchain to remain the single source of truth).

---

# API

Add

```text
GET /api/payment/currency
```

Returns

```json
{
  "currency": "USDm"
}
```

Admin

```text
PATCH /api/payment/currency
```

Body

```json
{
  "currency": "USDC"
}
```

---

# One important rule

I would **not** allow each user to choose their own payment token.

Keep it **global**.

If today Sentry operates in

USDm

then

every user

deposits

USDm.

Tomorrow

the admin changes

to

USDC.

Now

everyone

uses

USDC.

This keeps:

* billing simple,
* pricing simple,
* UI simple,
* smart contracts simple,
* accounting simple.

---

## Add this amendment to Prompt 6

> **Payment Currency Management**
>
> The Employment smart contract must support exactly four payment currencies: **CELO (native), USDm, USDC, and USDT**. The contract owner can configure one global active payment currency at any time. All deposits, withdrawals, and charges must use only the currently active currency. Users cannot choose a different currency. The frontend must clearly display the active payment currency on the Dashboard, Wallet, Deposit, Pricing, and Billing pages. The backend, billing engine, and charge records must include the active currency in every financial operation. No currency conversion or exchange-rate logic should be implemented in the MVP.

I think this design is the simplest, easiest to audit, and most appropriate for a hackathon while still showcasing Sentry as a **Celo-native** application built around the ecosystem's core assets.

---

I like this idea **a lot more** than exposing a `deposit()` function.

In fact, I think it's the right architecture.

One of the biggest UX problems in Web3 is asking users to:

> Connect wallet → Approve → Call deposit() → Wait → Confirm.

Instead, your approach makes Sentry behave like a real bank account.

> "Here's your wallet address. Send funds to it."

That's immediately understandable.

## I would change the architecture as follows

### Remove

The smart contract should **not** require:

```solidity
deposit()
```

Users should never have to call it.

---

### New Flow

```text
User

↓

Sentry

↓

"Show my wallet"

↓

0xABC...

↓

User sends CELO / USDm / USDC / USDT

↓

Smart Wallet receives funds

↓

Balance automatically increases

↓

Dashboard updates
```

Exactly how a normal crypto wallet works.

---

## Smart Wallet

Each Smart Wallet becomes a contract account capable of holding:

* CELO
* USDm
* USDC
* USDT

directly.

The Employment contract then authorizes spending **from that Smart Wallet**.

---

## Balance

Never store balance manually in the database.

Instead:

```text
Dashboard

↓

Blockchain

↓

Smart Wallet Balance
```

The database may cache balances for performance, but the blockchain should remain the source of truth.

---

## How Sentry knows a deposit happened

No contract call is needed.

Instead, implement a blockchain listener.

```text
Celo Mainnet

↓

Transfer detected

↓

Recipient == Smart Wallet

↓

Update cache

↓

Notify user

↓

Employment becomes Active (if previously exhausted)
```

This can be done by indexing `Transfer` events for supported ERC-20 tokens and native CELO transfers.

---

## Withdrawals

Withdrawals still go through the Smart Wallet.

The Employment contract (or Smart Wallet logic) validates that only the authorized owner can initiate withdrawals.

---

## Charging

Charging remains the same.

```text
Action Completed

↓

Employment Contract

↓

Charge()

↓

Transfer from Smart Wallet

↓

Treasury Wallet
```

---

## Dashboard

Instead of a generic Deposit button, show:

```text
Wallet Address

0xABCD...

[Copy]

[Show QR Code]

Current Currency

USDm

Current Balance

24.62 USDm
```

This feels much more like a real wallet.

---

## Telegram

Users can simply ask:

> What's my wallet?

or

> Show my deposit address.

Sentry replies:

```text
Your Sentry Wallet

0xABCD...

Accepted Currency

USDm

Send funds to this address.

Your balance will update automatically after confirmation.
```

That creates a nice conversational experience.

---

## One architectural improvement I'd make

I would actually **separate the Smart Wallet from the Employment Contract**.

Instead of this:

```text
Employment Contract

↓

Stores funds
```

I'd do this:

```text
User Smart Wallet

↓

Stores assets

↓

Employment Contract

↓

Authorized to charge
```

This separation is much cleaner because:

* The Smart Wallet's responsibility is **asset custody**.
* The Employment Contract's responsibility is **employment rules and billing**.
* Neither contract mixes financial storage with business logic.

It also makes future features—such as spending limits, multiple employees, or different payment strategies—much easier to add without changing where user funds live.

I think this is the strongest architectural decision you've made so far. It makes Sentry feel like a true Web3-native product rather than a traditional application wrapped around a smart contract.

---

# Revised Architecture

There are now **two equally valid funding methods**.

## Method 1 — Explicit Deposit (Web)

This is the traditional Web3 flow.

```text
External Wallet
        │
        ▼
Connect Wallet
        │
        ▼
Deposit()
        │
        ▼
Employment Smart Wallet
```

Users:

* connect MetaMask/MiniPay/etc.
* choose amount
* click Deposit
* transaction executes
* balance updates

This is the familiar UX.

---

## Method 2 — Direct Transfer (No Wallet Connection)

Every user owns a permanent Smart Wallet.

Sentry simply exposes its address.

```text
Any Wallet

↓

Send CELO / USDm / USDC / USDT

↓

Employment Smart Wallet

↓

Balance updates
```

No wallet connection.

No frontend interaction.

No deposit screen.

Just send funds.

This is especially nice for Telegram users.

---

# Internal Wallet Identity

This is the part I really like.

Instead of identifying wallets only by blockchain address,

Sentry should maintain an identity mapping.

For example:

```text
Telegram User

↓

Telegram ID

↓

SHA256

↓

bytes32

↓

Smart Wallet
```

Likewise:

```text
Email

↓

SHA256

↓

bytes32

↓

Smart Wallet
```

or

```text
Connected Wallet

↓

Wallet Address

↓

Smart Wallet
```

Everything points to the same Employment Wallet.

---

# Identity Mapping

I would introduce one concept.

```solidity
Identity
```

Not User.

Not Wallet.

Identity.

Example

```text
bytes32 identityHash

↓

Employment Wallet
```

The backend computes:

```text
telegram:12345678

↓

SHA-256

↓

bytes32
```

or

```text
email:alice@example.com

↓

SHA-256

↓

bytes32
```

Never store the raw identifier on-chain.

---

# Contract

Instead of

```solidity
mapping(address => Wallet)
```

I'd use

```solidity
mapping(bytes32 => address)
```

That makes the contract independent of authentication methods.

Later you could support:

* Telegram
* Email
* Google
* Farcaster
* Wallet
* MiniPay

without changing the contract.

---

# Funding Detection

Whenever funds arrive,

the backend checks

```text
Recipient Address

↓

Employment Wallet

↓

Lookup Identity

↓

Update UI

↓

Notify User
```

Simple.

---

# Frontend

Wallet page becomes:

```text
Employment Wallet

0xABCD...

[Copy]

[QR Code]

───────────────

Funding Options

① Connect Wallet

Deposit

② Send Funds Directly

Copy Address

Current Balance

24.25 USDm
```

Very clear.

---

# Telegram

The bot should understand commands like:

```text
/mywallet

/balance

/deposit
```

Example:

```
Your Sentry Employment Wallet

0xABCD...

Accepted Currency

USDm

You can either:

• Send USDm directly to this address.

or

• Visit the dashboard to deposit from a connected wallet.

Current Balance

14.32 USDm
```

---

# One thing I would change

I would **not use a raw SHA-256 hash alone** as the on-chain identity key.

Instead, namespace the identifier before hashing to avoid collisions between identity types.

Examples:

```text
telegram:123456789
email:alice@example.com
wallet:0xabc123...
```

Then compute:

```
keccak256(namespace:value)
```

and store the resulting `bytes32`.

Using a namespaced hash has several advantages:

* A Telegram ID and an email that happen to produce similar inputs can never collide conceptually.
* You can support new identity providers later without modifying the contract.
* The on-chain data never exposes the user's actual Telegram ID or email.
* The mapping remains deterministic and easy to reproduce off-chain.

I think this is the cleanest identity model for Sentry. It preserves user privacy, keeps the contract simple, and supports both of your funding methods while maintaining a single internal Employment Smart Wallet per user.

---

# Agent Session Summary — Prompt 6 (2026-07-15)

## Prompt 5 fixes

- **Removed `credit()`** from `EmploymentContract.sol`. Funding via `depositNative()` / `depositERC20()` only.
- **Chain-first billing:** pending `ChargeRecord` → on-chain `charge()` → DB/cache update only after tx success. Failed charges stay `failed`/`pending`; user not billed. Replay protection via `chargedActions` mapping.

## Product polish (no new features)

- **AI reliability:** stricter prompts — short replies, no fabrication, exact uncertainty phrase, 2–5 sentence mentions, 1–2 sentence welcomes, 5–10 bullet summaries, timeout handling.
- **Telegram reliability:** bot removed → disable group; permission loss → notify; group rename on events; `/mywallet`, `/balance`, `/deposit` commands.
- **Error handling:** `SentryError` + clear codes (`EMPLOYMENT_INACTIVE`, `WALLET_NOT_FUNDED`, `BLOCKCHAIN_UNAVAILABLE`, `CHARGE_FAILED`, etc.).
- **Logging:** `lib/logger.ts` — important events only (employment, charges, bot events, summaries).
- **Dashboard:** employment, balance/spend/lifetime, groups connected/enabled, actions today, currency badge, recent activity with timestamps.
- **Group dashboard:** today's spend, recent mentions, moderation events.
- **Wallet page:** copy address, sync balance from chain, funding instructions, currency display.
- **README:** setup, env vars, deployment, billing, demo guide.

## Payment currency management

- Global currency: **CELO**, **USDm**, **USDC**, **USDT** via `PaymentConfig` + contract `activePaymentToken`.
- `ChargeRecord.currency`, pricing with currency suffix, currency badge on dashboard/wallet/pricing.
- `GET/PATCH /api/payment/currency` — admin via `ADMIN_EMAILS`.
- `/admin/payment` settings page.

## Contract v2

- Multi-currency vault with `PaymentToken` enum, `supportedTokens`, `depositNative`/`depositERC20`, `withdraw`, `charge`, `pause`/`resume`, `registerIdentity`, treasury payouts.
- Identity hashing: `lib/identity.ts` (`keccak256(namespace:value)`).

## Migration

`prisma/migrations/20260715200000_prompt6_polish/` — run when Postgres is up.

## Ops

- Set `SENTRY_OPERATOR_KEY`, `SENTRY_OWNER_KEY`, `ADMIN_EMAILS`, token addresses.
- Deploy + `pnpm contracts:sync`.
- Wallet **Sync Balance** after on-chain deposits.

---

# CTO Said

This is in excellent shape. At this point, I would **stop implementing product features**. The remaining work should focus on **finishing the product**, not expanding it.

I do, however, want to incorporate your latest wallet architecture before moving on.

---

# Fixes from Prompt 6

## 1. Dual Funding Model

Prompt 6 still leans toward `depositNative()` / `depositERC20()` as the primary funding mechanism.

Update the architecture to explicitly support **two equal funding methods**.

### Method A — Web Deposit

```text id="wdw20j"
Connect Wallet

↓

Deposit()

↓

Employment Smart Wallet
```

### Method B — Direct Transfer

```text id="dhjrje"
Any Wallet

↓

Transfer CELO / USDm / USDC / USDT

↓

Employment Smart Wallet

↓

Sync Balance

↓

Dashboard Updates
```

Both methods are first-class citizens.

---

## 2. Identity Registration

The summary introduces:

```text id="0w6b1m"
registerIdentity()
```

I would make one clarification.

The contract should **not** know anything about:

* Telegram IDs
* Email addresses

It only receives:

```text id="aqxkmp"
bytes32 identityHash
```

The backend is solely responsible for computing:

```text id="3vcgq2"
keccak256(
    namespace:value
)
```

Examples:

```text id="w4wbs9"
telegram:12345678

email:alice@example.com

wallet:0xabc...
```

The contract never stores raw identifiers.

---

# Prompt 7 — Production Readiness, Testing & Submission

## Objective

Freeze the feature set.

This prompt is about making Sentry reliable, professional, and ready for hackathon judging.

No new user-facing features should be introduced.

---

# Smart Wallet Improvements

Finalize the Employment Smart Wallet behavior.

Requirements:

* Every user owns exactly one Employment Smart Wallet.
* Wallet addresses never change.
* Users can fund wallets in two ways:

  * Deposit through the web application.
  * Send supported assets directly to the wallet address.
* The wallet page must clearly explain both methods.
* Add a **"Sync Balance"** action that refreshes balances from the blockchain.
* Balance synchronization must never overwrite newer on-chain balances with stale cached values.

---

# Smart Contract Review

Review the contract for:

* Access control
* Reentrancy protection
* Token validation
* Unsupported token rejection
* Event completeness
* Input validation

Ensure events exist for:

```text id="tldmhk"
IdentityRegistered

Deposited

Withdrawn

Charged

Paused

Resumed

PaymentCurrencyChanged

EmploymentExhausted
```

---

# Blockchain Synchronization

Implement a lightweight synchronization service.

Responsibilities:

* Refresh wallet balances.
* Detect direct transfers.
* Update cached balances.
* Notify users of successful funding.

Do not continuously poll.

Use scheduled synchronization at a sensible interval plus explicit user-triggered sync.

---

# Frontend Polish

Review every page.

Ensure:

* Consistent spacing.
* Consistent typography.
* Responsive layout.
* Loading states.
* Empty states.
* Error messages.
* Success messages.

Avoid placeholder text.

---

# Wallet Page

Final layout:

```text id="i2ktcw"
Employment Smart Wallet

Wallet Address

[ Copy ]

[ QR Code ]

Current Currency

Current Balance

Funding Options

1. Deposit from Connected Wallet

2. Send Funds Directly

[ Sync Balance ]
```

Display a note:

> Funds sent directly to this address will appear after blockchain synchronization.

---

# Dashboard

Review all cards.

Final cards:

```text id="nldg9u"
Employment Status

Current Balance

Today's Spend

Lifetime Spend

Groups Enabled

Actions Completed

Recent Activity
```

No additional widgets.

---

# Telegram Review

Verify:

* Bot joins groups correctly.
* Mention replies work.
* Welcome messages work.
* FAQ matching works.
* Notifications work.
* Commands:

```text id="j27p3y"
/start

/help

/mywallet

/balance

/deposit
```

All commands should return helpful responses.

---

# Testing

Create test cases for:

### Smart Contract

* Deposit CELO
* Deposit supported stablecoins
* Reject unsupported tokens
* Charge user
* Pause
* Resume
* Exhaustion
* Withdraw

---

### Backend

* Employment lifecycle
* Wallet creation
* Identity registration
* Action recording
* Billing
* Balance synchronization

---

### Telegram

* Join group
* Leave group
* Mention
* Welcome
* FAQ
* Moderation
* Notifications

---

# Documentation

Finalize:

* Installation
* Environment variables
* Deployment
* Contract deployment
* Telegram setup
* Demo walkthrough
* Architecture overview

Include a simple architecture diagram.

---

# Demo Checklist

Before submission, verify:

* User hires Sentry.
* Employment Smart Wallet is created.
* User funds the wallet (both deposit methods demonstrated if possible).
* Balance updates.
* Sentry joins a Telegram group.
* Mention reply works.
* FAQ works.
* Welcome message works.
* Daily summary runs.
* ActionRecord created.
* Successful on-chain charge.
* Dashboard updates.
* Celo transaction visible.

---

# Acceptance Criteria

Sentry is considered complete when:

* ✅ All core functionality works without manual intervention.
* ✅ Smart Wallet funding works via both supported methods.
* ✅ Only CELO, USDm, USDC, and USDT are accepted.
* ✅ Employment lifecycle behaves correctly.
* ✅ Billing is synchronized with successful on-chain charges.
* ✅ Telegram interactions are reliable.
* ✅ Dashboard accurately reflects blockchain state.
* ✅ The application is ready for a live hackathon demonstration.

---

## Final architectural note

From this point onward, **do not expand the scope**.

The project now has a coherent identity:

* **One AI employee**.
* **One problem domain** (Telegram community management).
* **One employment model**.
* **One internal Employment Smart Wallet per user**.
* **One blockchain (Celo Mainnet)**.
* **One pricing model (pay per completed work)**.

That level of focus is exactly what tends to produce strong hackathon demos. Every remaining effort should go into reliability, UX, testing, and presentation rather than adding more capabilities.

---

# Agent Session Summary — Prompt 7 (2026-07-15)

## Prompt 6 fixes

- **Dual funding (first-class):** Method A — connect wallet + `depositNativeFor` / `depositERC20For` via wallet UI; Method B — direct transfer + **Sync Balance**.
- **Identity:** Contract receives only `bytes32 identityHash`; backend computes `keccak256(namespace:value)` (`lib/identity.ts`).

## Smart wallet

- Permanent employment wallet per user (`wallet-provider.ts` deterministic address).
- `GET /api/wallet/deposit/prepare` — deposit config for web UI.
- `POST /api/wallet/sync` — explicit user-triggered sync.
- Safe cache: on-chain read when available; never overwrite cache with failed/zero reads.

## Blockchain sync

- `services/sync.service.ts` — refresh balances, detect deposits, notify users.
- Scheduler: wallet sync every 5 minutes (not continuous polling).

## Smart contract

- `depositNativeFor` / `depositERC20For` for web deposits to employment wallet.
- Reentrancy guard on `charge` / `withdraw`.
- Events: `PaymentCurrencyChanged`, `EmploymentExhausted`, `IdentityRegistered`, etc.
- `MockERC20.sol` + expanded Hardhat tests (deposit, charge, exhaust, identity, currency).

## Frontend

- **Wallet page:** copy, QR code, dual funding sections, web deposit (viem + MetaMask/MiniPay), sync note.
- **Dashboard:** Employment Status, Balance, Today/Lifetime Spend, Groups Enabled, Actions Completed, Recent Activity only.

## Testing

- `pnpm test` — backend tests (`tests/backend.test.ts`).
- `pnpm test:contracts` — Hardhat suite.

## Documentation

- README: architecture diagram (mermaid), dual funding, testing, demo checklist.

---

# CTO Said

This is **much better than I expected**. At this point, I don't think Sentry needs another implementation prompt.

I think it needs a **release engineering prompt**.

Looking at the summary, I see a few things I'd change before calling the project MVP-complete.

---

# 1. Remove deterministic wallet addresses

This is the only thing that worries me.

The summary says:

> Permanent employment wallet (`wallet-provider.ts` deterministic address)

I would **not** derive wallet addresses deterministically from a hash.

Instead:

```text
User hires Sentry

↓

Factory deploys a Smart Wallet

↓

Wallet address stored forever
```

That is much safer and much closer to how smart account systems work.

So Prompt 8 should replace deterministic wallets with a **WalletFactory** contract.

---

# 2. Remove MockERC20 from production

Keep it only inside

```text
test/
```

Never deploy it.

---

# 3. Scheduler

Five minutes is okay.

I wouldn't go lower.

---

# 4. Sync

I'd also add

```text
Sync Balance
```

after every successful deposit transaction.

No need to wait five minutes if the user just deposited from the UI.

---

Everything else looks excellent.

---

# Prompt 8 — Release Candidate (RC1)

This is the final engineering prompt.

After this, **no more implementation**.

Only bug fixes.

---

## Objective

Prepare Sentry for hackathon submission.

No new functionality.

Only quality.

---

# Wallet Factory

Replace deterministic wallet generation.

Implement

```text
EmploymentWalletFactory
```

Responsibilities

```text
Create Employment Wallet

Register Identity

Return Wallet Address
```

Every user gets

exactly one

Employment Wallet.

Never regenerate.

Store permanently.

---

# Smart Wallet

Review

* ownership
* access control
* token handling
* pause
* resume

No functional changes.

Only improvements.

---

# Deposit UX

After successful

web deposit

↓

Automatically

```text
Sync Balance

↓

Refresh Dashboard

↓

Notify User
```

No manual refresh required.

The manual **Sync Balance** button remains for direct transfers.

---

# Direct Transfer UX

Improve the wallet page.

```text
Employment Wallet

0xABCD...

[ Copy ]

[ QR Code ]

────────────

Funding Methods

① Deposit from Connected Wallet

② Send Funds Directly

────────────

Accepted Currency

USDm

────────────

Current Balance

24.35
```

Everything should fit on one screen.

---

# Telegram Polish

Improve responses.

Examples

Instead of

> I don't know.

Use

> I couldn't determine that from the available conversation or configured FAQs.

Much more natural.

---

# AI Prompt Review

Audit prompts.

Remove:

* repetition
* unnecessary instructions
* token waste

Keep prompts compact.

---

# Smart Contract Audit

Review for

* reentrancy
* integer safety
* ownership
* duplicate charging
* unsupported tokens
* event emission

No feature changes.

---

# Dashboard Polish

Review

* mobile responsiveness
* dark mode
* spacing
* loading
* error states
* empty states

No redesign.

---

# Performance

Review

* unnecessary queries
* duplicate OpenAI calls
* duplicate Telegram calls
* unnecessary blockchain reads

Optimize only obvious issues.

---

# Final Testing

Run

Backend

Telegram

Contracts

Wallet

Billing

Scheduler

Deployment

Fix every failing test.

---

# Demo Mode

Add

```text
DEMO_MODE=true
```

Purpose

Allow judges to demonstrate

without risking production funds.

When enabled

Use

small values

Example

```text
Reply

0.0001 USDm
```

instead of

```text
0.01
```

No other behavior changes.

---

# Deployment

Prepare

Production

Environment Variables

Deployment Guide

Telegram Setup

Celo Mainnet Deployment

README

One-command start.

---

# Final Acceptance Criteria

Sentry should now be:

* Feature complete.
* Stable.
* Tested.
* Ready for judges.
* Ready for production deployment after minor refinements.

---

## Agent Session Summary — Prompt 8 (RC1)

**Date:** 2026-07-15

### Wallet Factory (replaces deterministic addresses)

- Added `EmploymentWallet.sol`, `EmploymentWalletFactory.sol`, `IEmploymentRegistry.sol`.
- Factory deploys one real smart wallet per `identityHash`, registers identity on `EmploymentContract`, idempotent `createWallet`.
- `EmploymentContract`: `identityRegistrars` mapping so factory can call `registerIdentity`.
- Deploy script `02_deploy_wallet_factory.ts` authorizes factory as registrar.
- `lib/wallet-provider.ts` → `EmploymentFactoryWalletProvider` via `blockchainService.ensureEmploymentWallet()`.
- `sync-data.js` syncs both `EmploymentContract` and `EmploymentWalletFactory` to `lib/contracts/`.

### MockERC20

- Moved from `contracts/MockERC20.sol` to `contracts/mocks/MockERC20.sol` (test-only; never deployed).

### Deposit UX

- Web deposit waits for tx receipt, auto-syncs balance, notifies user, dispatches `sentry:wallet-updated` for dashboard refresh.
- Wallet page compact single-screen layout per spec (address, copy, QR, funding ①②, currency, balance).
- Manual Sync Balance retained for direct transfers.

### Polish

- `lib/messages.ts`: natural uncertain reply for AI + Telegram.
- Compact AI system prompt (`services/ai.service.ts`).
- `DEMO_MODE=true` scales pricing 100× down via `lib/demo-mode.ts`.
- Removed duplicate on-chain balance read in `wallet.service.getBalance()`.
- Dashboard listens for wallet update events.

### Deployment & docs

- `pnpm start:all` — prisma generate + migrate + dev.
- README: factory architecture, Telegram setup, `DEMO_MODE`, deployment notes.

### Tests

- `pnpm test` — 7 passing (identity, pricing demo mode, currency).
- `pnpm test:contracts` — 12 passing (EmploymentContract + EmploymentWalletFactory).
- Fixed stablecoin deposit tests (switch active token first) and replay-protection test ordering.

### Env

- `.env.example`: `DEMO_MODE=false`.

---

# CTO Said

# Prompt 8 — Refactor Billing & Settlement Architecture

## Objective

Refactor Sentry's payment architecture from **immediate on-chain charging per completed task** to a **prepaid settlement model**.

This is a fundamental architectural change intended to:

* Reduce blockchain transaction costs.
* Improve scalability.
* Preserve a responsive Telegram experience.
* Keep Celo Mainnet as the financial source of truth.
* Ensure the platform never subsidizes gas costs.

Do **not** add new product features. This prompt only changes how payments are accounted for and settled.

---

# Why This Change

The current implementation submits an on-chain `charge()` transaction after every completed action.

Although technically correct, this creates unnecessary blockchain transactions and can result in gas costs exceeding the value of small actions.

The new architecture separates:

* **Work Accounting**
* **Blockchain Settlement**

This follows how real-world payment systems operate.

---

# New Payment Model

Users still prepay before Sentry begins working.

The difference is that completed work is accumulated off-chain and settled periodically.

Flow:

```text
User Funds Employment Wallet
            │
            ▼
Available Balance Calculated
            │
            ▼
AI Completes Work
            │
            ▼
ActionRecord Created
            │
            ▼
Outstanding Charges Increased
            │
            ▼
Settlement Threshold Reached
            │
            ▼
Single On-chain Settlement
            │
            ▼
Treasury Receives Payment
```

---

# Employment Wallet

The Employment Smart Wallet remains the user's dedicated wallet.

Users can fund it using either:

### Method 1

Connect wallet

↓

Deposit from Sentry dashboard

### Method 2

Transfer CELO / USDm / USDC / USDT directly to the Employment Wallet address.

Both methods are equally supported.

---

# Blockchain Source of Truth

Funds always exist on-chain.

The backend must never invent balances.

Maintain:

* Cached On-chain Balance
* Outstanding Charges

Calculate:

```text
Available Balance =
Cached On-chain Balance
−
Outstanding Charges
```

Before Sentry performs any billable action:

Check whether

```text
Available Balance >= Estimated Cost
```

If false:

* Stop work.
* Mark Employment as Exhausted.
* Notify the user.

No further billable actions should be performed until additional funds are deposited or unsettled charges are reduced.

---

# Outstanding Charges

Introduce a new concept:

Outstanding Charges.

Definition:

The total value of completed billable work that has **not yet been settled on-chain**.

Outstanding Charges are maintained entirely by the backend.

Every successful ActionRecord increases Outstanding Charges.

No blockchain transaction occurs at this stage.

---

# Settlement

Settlement transfers accumulated earnings from the Employment Wallet to the Treasury.

Settlement occurs when **any** of the following conditions is true:

* Outstanding Charges exceed the configured monetary threshold.
* Outstanding billable actions reach the configured action threshold.
* The maximum settlement interval has elapsed.

Example configuration:

* Monetary Threshold: 0.50 cUSD
* Action Threshold: 5 completed actions
* Time Threshold: 15 minutes

These values must be configurable.

Do not hardcode them.

---

# Settlement Fee

Every settlement incurs blockchain transaction costs.

The platform must never absorb this cost.

Before submitting a settlement transaction:

Estimate the blockchain transaction cost.

Calculate:

```text
Settlement Amount =
Outstanding Charges
+
Estimated Settlement Fee
```

Transfer both amounts from the user's Employment Wallet.

The Treasury receives:

* Service Revenue
* Settlement Fee

Record both separately.

Do not merge them into one accounting value.

---

# Withdrawal Rules

Users may withdraw funds at any time.

However, they may only withdraw their:

Available Balance.

Formula:

```text
Withdrawable Balance =
On-chain Balance
−
Outstanding Charges
```

Reject withdrawals that would reduce the wallet below Outstanding Charges.

Example:

On-chain Balance

50 USDm

Outstanding

4 USDm

Maximum Withdrawal

46 USDm

---

# Settlement Lifecycle

Implement the following lifecycle.

```text
Action Completed
        │
        ▼
ActionRecord
        │
        ▼
Outstanding Charges Updated
        │
        ▼
Settlement Trigger
        │
        ▼
Estimate Gas Cost
        │
        ▼
Submit Settlement
        │
        ├──────────────┐
        │              │
        ▼              ▼
Success          Failure
        │              │
        ▼              ▼
Outstanding      Retry Later
Reset
```

If settlement fails:

* Do not lose Outstanding Charges.
* Retry later.
* Never double-charge.

---

# Database Changes

Add:

## Settlement

Fields:

* id
* userId
* walletId
* amount
* settlementFee
* currency
* actionCount
* transactionHash
* status
* createdAt
* completedAt

---

Update ActionRecord

Add:

* settlementId (nullable)

An ActionRecord belongs to at most one Settlement.

---

Employment

Add:

* outstandingCharges
* lastSettlementAt

---

# Billing Engine

Replace immediate charging.

Implement:

```text
recordAction()

calculateOutstanding()

estimateSettlementFee()

canPerformAction()

settleEmployment()

retrySettlement()
```

Remove immediate `chargeUser()` calls after every completed task.

Charging now occurs only during settlement.

---

# Smart Contract Changes

The contract no longer receives one transaction per ActionRecord.

Instead:

The operator submits a single settlement transaction.

Example:

```text
chargeSettlement(
    wallet,
    totalAmount,
    settlementId
)
```

The contract should:

* Validate authorization.
* Prevent duplicate settlements.
* Transfer funds.
* Emit SettlementCompleted.

The contract should not know about individual ActionRecords.

Action accounting remains off-chain.

---

# Frontend Changes

## Dashboard

Replace:

Today's Spend

with:

Today's Spend

Outstanding Charges

Available Balance

Last Settlement

Next Settlement

---

## Wallet Page

Display:

Current Balance

Outstanding Charges

Withdrawable Balance

Settlement Status

Last Settlement

Funding Options

Sync Balance

---

## Billing History

Separate:

Completed Settlements

Outstanding Charges

Users should clearly understand:

* What has already been paid.
* What is pending settlement.

---

# Scheduler

The scheduler should now additionally:

* Evaluate settlement thresholds.
* Trigger settlements.
* Retry failed settlements.

Do not continuously poll the blockchain.

Use the existing scheduler infrastructure.

---

# Notifications

Notify users when:

* Outstanding Charges become significant.
* Settlement completes.
* Settlement fails.
* Wallet balance becomes insufficient.
* Employment pauses because available funds are exhausted.

---

# Security

Prevent:

* Duplicate settlement.
* Double billing.
* Settlement replay.
* Negative outstanding balances.
* Withdrawals that exceed available balance.

The blockchain remains the source of truth for deposited funds.

The backend remains the source of truth for unsettled work.

---

# Acceptance Criteria

The implementation is complete when:

* Users continue funding the same Employment Smart Wallet.
* Sentry checks Available Balance before every billable action.
* Completed work increases Outstanding Charges without immediately calling the blockchain.
* Settlement batches multiple completed actions into one blockchain transaction.
* Settlement fees are estimated and charged to the user's wallet.
* Withdrawals are limited to the Withdrawable Balance.
* Failed settlements can be retried safely.
* Dashboard clearly displays Current Balance, Outstanding Charges, Available Balance, and Settlement History.
* No existing Telegram functionality is broken by this refactor.

This prompt supersedes the previous immediate per-action charging implementation and becomes the canonical billing architecture for Sentry.

---

## Agent Session Summary — Prompt 8 (Settlement Billing Refactor)

**Date:** 2026-07-15

### Architecture change

Replaced immediate per-action `charge()` with **prepaid settlement model**:
- Completed work → `ActionRecord` + pending `ChargeRecord` → outstanding charges increase (no chain tx).
- Settlement batches outstanding work into one `chargeSettlement(wallet, totalAmount, settlementId)` on-chain.
- **Available balance** = on-chain balance − outstanding charges gates all billable work.

### Database

- New `Settlement` model (amount, settlementFee, actionCount, status, transactionHash).
- `Employment.outstandingCharges`, `Employment.lastSettlementAt`.
- `ActionRecord.settlementId` links actions to batch settlements.

### Services

- `billing.service.ts`: `recordAction()`, `canPerformAction()`, `settleEmployment()`, `retrySettlement()`, `evaluateSettlements()`, `getBalanceLedger()`.
- Removed immediate `chargeUser()` flow from action completion.
- `employment.service.ts`: gates on available balance; dashboard exposes settlement fields.
- `wallet.service.ts`: withdrawals capped at withdrawable balance.
- `scheduler.service.ts`: evaluates settlement thresholds + retries failures every 5 min.

### Smart contract

- `EmploymentContract.chargeSettlement()` with `settledBatches` replay protection and `SettlementCompleted` event.

### Config (env)

- `SETTLEMENT_MONETARY_THRESHOLD`, `SETTLEMENT_ACTION_THRESHOLD`, `SETTLEMENT_INTERVAL_MINUTES`, `SETTLEMENT_FEE_ESTIMATE`.

### UI

- Dashboard: outstanding, available, last/next settlement.
- Wallet: outstanding, withdrawable, settlement status, withdraw form.
- Billing history API returns `{ settlements, outstanding }` separately.

### Tests

- `pnpm test` — 8 passing (includes settlement config).
- `pnpm test:contracts` — 13 passing (includes `chargeSettlement` test).


---

# CTO Said

# Prompt 9 — Smart Contract Hardening & Complete Test Rewrite

## Objective

The smart contract architecture has been redesigned.

The project now consists of:

* `SentryWallet.sol`
* `SentryWalletFactory.sol`
* `EmploymentManager.sol`

Do **not** attempt to patch the previous contract architecture.

Treat these three contracts as the new source of truth.

Your task is to harden the contracts to production quality and completely rewrite the test suite around the new architecture.

---

# Part 1 — Contract Hardening

Perform a complete security and architecture review before touching the tests.

## 1. Replace IERC20 transfers

Replace every raw:

```solidity
transfer(...)
transferFrom(...)
```

with OpenZeppelin's:

```solidity
SafeERC20
```

Use

```solidity
safeTransfer()
safeTransferFrom()
```

throughout the project.

This improves compatibility with non-standard ERC20 implementations.

---

## 2. Add Pausable

`EmploymentManager`

should inherit

```solidity
Pausable
```

Only Owner may:

* pause()
* unpause()

When paused:

* settlements cannot execute
* employments cannot change state

Withdrawals from user wallets should still work.

---

## 3. Zero-address validation

Review every constructor and setter.

Reject zero addresses where appropriate.

Examples:

* treasury
* operator
* token addresses
* manager
* owner

---

## 4. Missing events

Emit events whenever:

* operator changes
* treasury changes
* payment currency changes
* supported token changes
* wallet created
* employment registered

Review all public state-changing functions.

Every meaningful state change should emit an event.

---

## 5. Custom errors

Replace remaining

```solidity
require(...)
```

messages with

custom errors

where appropriate.

Maintain consistency across all contracts.

---

## 6. NatSpec

Document every:

* contract
* public function
* external function
* event
* error

Use proper Solidity NatSpec.

---

## 7. Storage review

Review storage layout.

Remove unnecessary variables.

Pack structs efficiently.

Avoid duplicated state.

---

## 8. Reentrancy review

Review every external function.

Ensure only functions performing value transfers are protected with:

```solidity
nonReentrant
```

Do not overuse it.

---

## 9. Visibility review

Review every function.

Use:

* private
* internal
* external
* public

appropriately.

---

## 10. Gas optimization

Review for:

* unnecessary storage writes
* repeated SLOADs
* unnecessary memory allocations

Only optimize where it improves readability.

Do not sacrifice clarity.

---

# Part 2 — WalletFactory Improvements

Review whether CREATE2 is appropriate.

If CREATE2 improves the architecture without increasing complexity significantly:

Implement it.

Otherwise:

Keep CREATE.

Document the reasoning.

Do not introduce unnecessary complexity simply because CREATE2 exists.

---

# Part 3 — Security Review

Review:

* replay protection
* settlement authorization
* duplicate wallet creation
* duplicate settlements
* ownership transfer
* manager authorization
* unsupported token handling

Fix any issue found.

---

# Part 4 — Rewrite Tests

Do **not** update existing tests.

Delete the previous assumptions.

Rewrite the test suite from scratch.

The new tests must validate the new architecture.

---

## SentryWallet Tests

Test:

* native CELO receive
* ERC20 receive
* owner withdraw native
* owner withdraw ERC20
* unauthorized withdrawal
* settlement execution
* unauthorized settlement
* EIP-1271 validation
* supported token balances

---

## WalletFactory Tests

Test:

* create wallet
* duplicate identity rejection
* duplicate owner rejection (one wallet per owner)
* identity lookup
* owner lookup
* wallet lookup
* token update

---

## EmploymentManager Tests

Test:

* register employment
* pause employment
* resume employment
* exhaust employment
* settlement execution
* duplicate settlement rejection
* invalid wallet rejection
* invalid employment status
* payment currency switching
* treasury update
* operator update

---

## Integration Tests

Build end-to-end tests.

Scenario:

* User registered
* Wallet created
* Employment started
* Wallet funded
* Outstanding charges simulated
* Settlement executed
* Treasury receives funds
* Wallet balance reduced
* Replay prevented

---

## Failure Tests

Explicitly test:

* zero address
* invalid token
* unsupported token
* settlement replay
* unauthorized operator
* unauthorized wallet execution
* paused manager
* insufficient funds

---

## Coverage

Target:

100% coverage

for:

* contracts
* public functions
* settlement flow

---

# Part 5 — Cleanup

After tests pass:

Run:

* formatter
* linter
* compile
* test

Remove:

* dead code
* unused imports
* unused events
* commented code

---

# Deliverables

Provide a final implementation summary including:

* Architecture improvements
* Security improvements
* Gas optimizations
* Test coverage
* Files changed
* Any intentional design decisions

The goal is to leave the smart contract layer in a production-quality state that fully aligns with the redesigned Sentry architecture.

---

## Agent Session Summary — Prompt 9

**Date:** 2026-07-16

### Architecture improvements

- Replaced the retired `EmploymentContract` / `EmploymentWallet` architecture with:
  - `SentryWallet.sol` — owner-controlled custody, manager-only settlements, EIP-1271.
  - `SentryWalletFactory.sol` — one wallet per identity and one wallet per owner.
  - `EmploymentManager.sol` — validated employment lifecycle and replay-protected batch settlement.
- Updated Hardhat deployment and ABI sync configuration for `EmploymentManager` and `SentryWalletFactory`.
- Removed old contracts, interfaces, deployment script, and assumption-based tests.

### Security improvements

- Replaced raw ERC20 transfers with OpenZeppelin `SafeERC20`.
- Added owner-controlled global `Pausable` protection to employment changes and settlements; wallet withdrawals remain available.
- Added zero-address and identity validation across constructors, setters, registration, and settlement execution.
- Fixed EIP-1271 validation to check signatures against `owner()` rather than `msg.sender`; malformed signatures return the invalid signature value without reverting.
- Employment registration now validates deployed bytecode, wallet manager, wallet owner, duplicate users, and duplicate wallets.
- Settlement checks use effects-before-interactions and preserve replay IDs when an external transfer reverts.
- Added custom errors and events for meaningful state changes.
- Added full NatSpec for contracts, public/external functions, events, and errors.

### Storage and gas

- Packed `Employment` into one storage slot (`address`, `uint64`, enum).
- Replaced duplicated supported-wallet state with `userOfWallet`, which also enforces one employment per wallet.
- Cached storage values in setters and avoided writes/events when configuration is unchanged.
- Kept CREATE intentionally: deployed addresses are persisted, while CREATE2 would add salt and init-code complexity without improving wallet uniqueness.

### Test rewrite

- Deleted the legacy contract tests and rewrote the suite around the new architecture.
- Added dedicated suites for `SentryWallet`, `SentryWalletFactory`, `EmploymentManager`, and end-to-end integration.
- Coverage includes native/ERC20 custody and withdrawals, EIP-1271, lifecycle transitions, global pause, authorization, duplicate prevention, unsupported inputs, insufficient funds, settlement fees, treasury transfer, and replay protection.
- Result: **31 passing tests**.
- Coverage: **100% functions**, **100% lines**, **96.59% statements**, **73.94% branches**.

### Validation

- `pnpm compile` — passed.
- `pnpm test` — 31 passing.
- `pnpm coverage` — passed with 100% function and line coverage.
- `pnpm run deploy` — local deployment passed for both production contracts.
- TypeScript tests/deploy scripts formatted with Prettier.

### Files changed

- Contracts: `EmploymentManager.sol`, `SentryWallet.sol`, `SentryWalletFactory.sol`, test-only `MockERC20.sol`.
- Tests: `EmploymentManager.ts`, `SentryWallet.ts`, `SentryWalletFactory.ts`, `Integration.ts`, `helpers.ts`.
- Tooling/docs: deployment script, `sync-data.js`, contract env example, package scripts, README.

---

# CTO Said:

# Prompt 10 — Multi-Currency Wallet Architecture & Manager-Controlled Custody

## Objective

Refine the smart contract architecture to align with the finalized Sentry payment model.

This prompt supersedes previous assumptions where:

* a single global payment currency exists, and
* users directly own and withdraw from their Sentry Wallet.

The architecture below becomes the new source of truth.

---

# 1. Payment Currency Model

Remove the concept of a single global active payment currency.

Instead, the system supports multiple accepted payment currencies simultaneously.

Initially supported:

* CELO
* USDm
* USDC
* USDT

Each supported currency has an independent enabled/disabled state.

Example:

```text
CELO   → Enabled
USDm   → Enabled
USDC   → Enabled
USDT   → Disabled
```

---

## Admin Controls

The owner/admin can:

* Enable a payment currency.
* Disable a payment currency.
* Update the token contract address (ERC20 currencies).

Disabling a currency only affects **future wallet creation**.

It must **never** affect existing wallets.

---

# 2. Wallet Currency

Every Sentry Wallet permanently stores its payment currency during deployment.

Example:

```text
Wallet A → USDm

Wallet B → CELO

Wallet C → USDC
```

Once created:

The wallet currency is immutable.

It can never be changed.

---

# 3. Wallet Creation

During wallet creation:

Validate that the selected currency is currently enabled.

If disabled:

Reject wallet creation.

After deployment:

Even if the admin disables that currency later:

The deployed wallet must continue operating normally.

---

# 4. Remove Global Currency Switching

Delete every remaining reference to:

```solidity
activePaymentToken
```

throughout the contracts.

Settlement uses the wallet's own configured currency.

Not a global variable.

---

# 5. Manager-Controlled Custody

This is the most important architectural change.

Users no longer become the owner of Sentry Wallets.

Instead:

Every newly created Sentry Wallet is owned by the EmploymentManager.

The EmploymentManager becomes the only entity capable of:

* withdrawing funds,
* executing settlements,
* transferring balances.

The backend never directly owns user funds.

The backend communicates only with EmploymentManager.

---

# 6. User Withdrawals

Users cannot call SentryWallet directly.

Every withdrawal request originates from:

* Web Dashboard
* Telegram Bot

Flow:

```text
User

↓

Withdraw Request

↓

Backend

↓

Outstanding Charges Calculated

↓

Settlement (if required)

↓

Remaining Balance

↓

EmploymentManager

↓

SentryWallet

↓

Funds sent to user's destination wallet
```

The wallet should expose only manager-authorized withdrawal functions.

---

# 7. Outstanding Charges

Outstanding Charges remain an off-chain accounting concept.

During withdrawal:

The backend calculates:

```text
Withdrawable Balance

=

Wallet Balance

−

Outstanding Charges

−

Estimated Settlement Fee
```

If Outstanding Charges exist:

EmploymentManager first settles them.

Only then should remaining funds be transferred to the user's destination wallet.

Users must never be able to bypass outstanding charges.

---

# 8. Destination Wallet

Every user profile should have a withdrawal destination.

This is independent of the Sentry Wallet.

Examples:

* MiniPay
* MetaMask
* Valora
* Safe
* Any EVM wallet

Users may update their destination wallet through the dashboard.

The Sentry Wallet remains unchanged.

---

# 9. SentryWallet Changes

Refactor SentryWallet accordingly.

It should:

* permanently store its payment currency,
* permanently store its identity hash,
* permanently know its EmploymentManager,
* remove owner-controlled withdrawal,
* expose only manager-authorized:

  * executeSettlement()
  * withdrawTo()

Users never interact with the contract directly.

---

# 10. EmploymentManager Changes

EmploymentManager becomes responsible for:

* settlement authorization,
* withdrawal authorization,
* treasury payments,
* payment currency validation,
* replay protection,
* employment lifecycle.

EmploymentManager should never store user balances.

The wallet remains the sole custodian of funds.

---

# 11. SentryWalletFactory Changes

During deployment:

Validate:

* currency enabled,
* identity unused,
* user does not already own a Sentry Wallet.

Deploy:

```text
SentryWallet
```

with:

* identity hash,
* immutable payment currency,
* EmploymentManager,
* supported token addresses.

Register mappings.

---

# 12. Backend Changes

Update all APIs.

Remove assumptions that users own the wallet.

Withdrawal endpoints should now:

1. Calculate outstanding charges.
2. Trigger settlement if required.
3. Withdraw remaining balance through EmploymentManager.
4. Transfer funds to the user's registered destination wallet.
5. Record settlement and withdrawal.

---

# 13. Database

Add (if not already present):

```text
withdrawalAddress

walletCurrency
```

`walletCurrency` is immutable after wallet creation.

`withdrawalAddress` is user-editable.

---

# 14. Tests

Completely update the contract tests.

Add coverage for:

## Multi-Currency

* create wallet with CELO
* create wallet with USDm
* create wallet with USDC
* reject disabled currency
* existing wallet still works after currency disabled

---

## Withdrawals

* withdraw without outstanding charges
* withdraw with outstanding charges
* settlement executed before withdrawal
* unauthorized withdrawal
* incorrect destination wallet
* insufficient funds

---

## Settlement

* settlement uses wallet currency
* duplicate settlement rejected
* settlement replay rejected

---

## Factory

* immutable wallet currency
* duplicate identity rejection
* duplicate wallet rejection

---

# 15. Deliverables

Provide:

* updated contract architecture summary,
* deployment changes,
* updated ABI sync,
* migration notes,
* rewritten test summary,
* coverage report.

The final architecture should satisfy the following principles:

* Sentry Wallets are true on-chain smart wallets.
* Each wallet has one immutable payment currency.
* Multiple payment currencies may coexist across the platform.
* Existing wallets are unaffected by future currency policy changes.
* Users never interact directly with wallet contracts.
* EmploymentManager is the only contract authorized to move user funds.
* Outstanding charges are always reconciled before withdrawals.
* The blockchain remains the source of truth for assets, while the backend remains the source of truth for unsettled work.

---

# Agent Session Summary — Prompt 10: Multi-Currency Manager-Controlled Custody

## Architecture delivered

- Removed the global active payment token from `EmploymentManager`.
- Every `SentryWallet` now stores an immutable currency, identity hash, manager, and selected ERC20 address (zero for CELO).
- Removed user/owner withdrawals from `SentryWallet`; only `EmploymentManager` can call `executeSettlement` and `withdrawTo`.
- Added factory currency policies with independent enable/disable state and token-address updates for future wallets only.
- Existing wallets retain their original currency and token address after future factory policy changes.
- Added manager withdrawal destinations, withdrawal replay protection, and an atomic `settleAndWithdraw` path.

## Backend and database

- Added immutable `Wallet.walletCurrency`, editable `User.withdrawalAddress`, per-currency configuration, and persisted `Withdrawal` history.
- Replaced global-currency reads throughout wallet, billing, employment, Telegram, and blockchain services with each wallet's currency.
- Wallet provisioning now validates an enabled currency, deploys through `SentryWalletFactory`, and registers the wallet with `EmploymentManager`.
- Withdrawal requests reserve outstanding charges and the estimated settlement fee, settle pending work first, then submit the remaining transfer through `EmploymentManager`.
- Added destination and withdrawal-history APIs plus dashboard controls for currency selection, direct CELO/ERC20 funding, destination updates, and manager-executed withdrawals.
- Updated admin payment controls to independently enable currencies and update ERC20 addresses.

## Deployment, ABI, and migration notes

- Updated application bindings to `EmploymentManager` and `SentryWalletFactory`; `sync-data.js` remains configured for those two contracts.
- Added `20260716110000_multi_currency_custody`, which replaces the global payment config and creates currency policy and withdrawal records.
- Existing legacy user-owned wallet deployments cannot be upgraded in place; they must be re-provisioned under the new factory/manager architecture before production migration.

## Tests and validation

- Smart-contract compile: passed.
- Rewritten contract tests: **20 passing**.
- Backend tests: **9 passing**.
- Solidity coverage: **85.85% statements**, **51.18% branches**, **88.24% functions**, **87.59% lines**.
- `SentryWallet.sol`: **100% statements/functions/lines**.
- Local Hardhat deployment succeeded for `EmploymentManager` and `SentryWalletFactory`.
- The production build/type-check commands were aborted after stalling in the local Windows environment without diagnostics; contract compilation and both test suites completed successfully.

---

# CTO Said

# Prompt 11 — Final Smart Contract Refinements

## Objective

This prompt contains the final refinements to the Sentry smart contract architecture.

**Do not redesign the architecture.**

The architecture is considered complete.

This prompt only improves maintainability, safety, upgradeability, and test coverage.

---

# 1. Wallet Versioning

Add versioning support.

Every wallet should expose:

```solidity
uint256 public constant VERSION = 1;
```

The factory should expose:

```solidity
uint256 public walletVersion;
```

Future wallet implementations should only require updating the factory.

Do not implement upgrades.

Only prepare the architecture.

---

# 2. Wallet Lifecycle

Introduce:

```solidity
enum WalletStatus {
    Provisioning,
    Active,
    Locked,
    Archived
}
```

This lifecycle belongs to the wallet.

It is independent of EmploymentStatus.

Examples:

Provisioning

↓

Wallet created

↓

Active

↓

Locked

↓

Archived

Employment may change independently.

The backend should synchronize wallet state where appropriate.

---

# 3. WalletFunded Event

Add:

```solidity
event WalletFunded(
    address indexed wallet,
    address indexed from,
    uint256 amount,
    PaymentCurrency currency
);
```

Whenever funds are successfully synchronized or deposited.

This simplifies indexing.

---

# 4. Withdrawal Replay Protection

Current settlement replay protection is correct.

Implement similar protection for withdrawals.

Example:

```solidity
mapping(bytes32 => bool) processedWithdrawals;
```

Every withdrawal receives:

```solidity
withdrawalId
```

Reject duplicate withdrawals.

The backend may safely retry failed requests without risking duplicate payouts.

---

# 5. Withdrawal Destination Confirmation

Users may update:

```text
withdrawalAddress
```

However,

the address should not become active immediately.

Implement:

Pending Withdrawal Address

↓

Confirmation

↓

Active Withdrawal Address

Confirmation may occur through:

* Telegram
* Email
* Dashboard confirmation

The smart contract does not need to know about this.

This is backend logic only.

---

# 6. Settlement Fee Buffer

The current gas estimate is not deterministic.

Implement:

```text
Estimated Settlement Fee

×

Configurable Buffer
```

Example:

```text
10%
```

The buffer must be configurable.

Never hardcode it.

This protects against gas fluctuations.

---

# 7. Branch Coverage

Current branch coverage is too low.

Increase contract branch coverage to at least:

```text
80%
```

Add tests covering:

* duplicate withdrawals
* duplicate settlements
* unsupported currencies
* disabled currencies
* paused manager
* invalid employment status
* invalid wallet
* insufficient balance
* settlement failure
* withdrawal failure
* unauthorized manager
* unauthorized factory
* zero address
* invalid identity
* duplicate identity
* duplicate wallet
* invalid destination
* manager pause/unpause
* emergency paths

Do not chase 100%.

Target realistic production coverage.

---

# 8. Documentation

Update NatSpec where necessary.

Document:

* wallet lifecycle
* settlement lifecycle
* manager authority
* payment currency policy
* replay protection
* withdrawal flow

---

# 9. Final Security Review

Perform one final review of:

* replay protection
* access control
* settlement authorization
* withdrawal authorization
* duplicate wallet creation
* duplicate settlements
* duplicate withdrawals
* unsupported token handling
* zero-address validation
* event consistency

Fix any issue discovered.

---

# Deliverables

Provide:

* updated implementation summary
* security review summary
* branch coverage report
* files modified
* final production readiness assessment

This prompt should be treated as the final smart contract refinement before feature freeze. After completing it, no further architectural changes should be made unless they fix a verified bug or security issue.

---

# Agent Session Summary — Prompt 11: Final Smart Contract Refinements

## Implementation summary

- Added wallet versioning: `SentryWallet.VERSION = 1` and `SentryWalletFactory.walletVersion`.
- Introduced wallet lifecycle (`Provisioning → Active → Locked → Archived`) independent of employment status, managed through EmploymentManager (`activate` on registration, `lockWallet`, `unlockWallet`, `archiveWallet`).
- Added `WalletFunded` for native CELO deposits and manager-notified ERC20 funding sync.
- Renamed withdrawal replay map to `processedWithdrawals` with `WithdrawalAlreadyProcessed` for safe backend retries.
- Backend withdrawal destinations now use pending → confirm → active flow (dashboard/API); only confirmed destinations sync on-chain.
- Settlement fee estimates apply a configurable buffer via `SETTLEMENT_FEE_BUFFER_PERCENT` (default 10%).
- Expanded NatSpec for lifecycle, manager authority, currency policy, and replay protection.

## Security review summary

- Access control: manager-only wallet fund movement; owner/operator separation retained; factory create restricted to owner.
- Replay protection: settlements and withdrawals both use effects-before-interactions with unique IDs; failed transfers revert and leave IDs reusable.
- Duplicate wallet/identity creation remains rejected at the factory.
- Zero-address and invalid-identity validation covered for constructors and admin setters.
- Locked/Archived wallets cannot settle or withdraw; pause blocks operator employment/settlement paths.
- Destination confirmation is backend-only by design; on-chain destination updates occur only after confirmation.
- No architectural redesigns; refinements only.

## Branch coverage report

| Metric | Result |
|--------|--------|
| Statements | **100%** |
| Branches | **80%** |
| Functions | **100%** |
| Lines | **98.82%** |
| Contract tests | **31 passing** |
| Backend tests | **10 passing** |

## Files modified

- Contracts: `SentryWallet.sol`, `SentryWalletFactory.sol`, `EmploymentManager.sol`, `mocks/RejectEther.sol`
- Tests: `SentryWallet.ts`, `SentryWalletFactory.ts`, `EmploymentManager.ts`, `BranchCoverage.ts`, `tests/backend.test.ts`
- Backend: `wallet.service.ts`, `blockchain.service.ts`, `billing.service.ts`, `settlement-config.ts`, destination API, wallet UI
- Schema/migration: `pendingWithdrawalAddress`, `walletStatus`
- Docs/env: README, `.env.example`, this summary

## Production readiness assessment

The smart-contract architecture is feature-frozen for refinements. Versioning prepares future factory-routed deployments without in-place upgrades. Lifecycle, funding events, withdrawal replay protection, destination confirmation, and buffered settlement fees are in place. Coverage meets the 80% branch target with full statement/function coverage. Remaining risk is operational (correct operator keys, confirmed destinations, and fee buffer tuning under live gas conditions), not architectural.

---

From this point forward, the Sentry architecture is feature complete.

Do not introduce any new features, abstractions, database models, APIs, smart contract functionality, or UI pages unless required to fix an existing bug.

Your sole objective is to make the project fully functional.

Tasks:

1. Resolve every TypeScript error.
2. Resolve every build error.
3. Resolve every runtime error.
4. Resolve every Prisma migration issue.
5. Resolve every contract integration issue.
6. Resolve every frontend integration issue.
7. Resolve every Telegram bot issue.
8. Resolve every blockchain integration issue.
9. Remove dead code, duplicate logic, and obsolete files introduced during previous refactors.
10. Verify the complete end-to-end flow:
   - User registration
   - Wallet provisioning
   - Employment activation
   - Wallet funding
   - Telegram group interaction
   - Billable action recording
   - Outstanding charge tracking
   - Settlement execution
   - Withdrawal to confirmed destination

If any step fails, fix the bug before proceeding.

Do not redesign or extend the architecture.

The project is now in stabilization mode.

At the end, provide:
- Remaining issues (if any)
- Build status
- Test status
- End-to-end verification status
- Deployment readiness checklist

---

