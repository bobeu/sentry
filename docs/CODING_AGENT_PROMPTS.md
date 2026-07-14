
## `05-CODING_AGENT_PROMPTS.md`

Instead of one enormous prompt.

Break into 12 prompts.

Example

---

Prompt 1

Create the project foundation.

---

Prompt 2

Implement Telegram Bot.

---

Prompt 3

Implement AI Context Engine.

---

Prompt 4

Implement Smart Contract.

---

Prompt 5

Wallet Management.

---

Prompt 6

Billing Engine.

---

Prompt 7

Dashboard.

---

Prompt 8

Reports.

---

Prompt 9

Scheduler.

---

Prompt 10

Configuration Panel.

---

Prompt 11

Testing.

---

Prompt 12

Production Polish.

---

# Final Tech Stack

Frontend

* Next.js
* Tailwind
* shadcn/ui

Backend

* NestJS
* PostgreSQL
* Prisma

Blockchain

* Celo
* Viem
* Smart Contract Wallet

AI

* OpenAI (pluggable later)

Telegram

* Telegraf

Scheduler

* BullMQ + Redis (or NestJS Schedule if keeping it simpler)

Deployment

* Docker
* Railway/Fly.io/VPS

---

## One final architectural decision

I want to make one important adjustment before we start implementation.

Earlier, we discussed **charging every task directly on-chain**. I no longer think that's the best MVP.

Instead:

* The user **deposits** funds into their on-chain wallet.
* Every completed task **updates an off-chain usage ledger** immediately.
* The blockchain balance remains the source of truth for available funds.
* The billing engine periodically (or after a configurable threshold of accumulated usage) settles the deducted amount against the user's on-chain balance through the smart contract.

This gives you:

* a fast Telegram experience,
* fewer blockchain transactions,
* lower gas costs,
* simpler smart contracts,
* and still demonstrates real on-chain payments tied to agent work.

It also keeps the product aligned with your original vision: users prepay on-chain, Sentry works autonomously until the balance is exhausted, and payments remain transparent without overcomplicating the MVP. I think this is the cleanest architecture for a hackathon while leaving room for finer-grained settlement later if the project evolves.
