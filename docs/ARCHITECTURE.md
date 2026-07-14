## `02-ARCHITECTURE.md`

Very simple architecture.

```
Telegram

↓

Bot Service

↓

AI Service

↓

Context Engine

↓

Billing Engine

↓

Scheduler

↓

Smart Contract

↓

Celo
```

---

### Components

Bot Service

* receives updates
* sends replies
* group management

AI Service

* prompts
* moderation
* FAQ
* summaries

Context Engine

Keeps conversation memory.

Example:

```
Recent 100 messages

+

Pinned messages

+

Rules

+

FAQs

+

User Settings

↓

Prompt
```

No need for complicated vector DB for MVP.

---

Billing Engine

Every billable action produces:

```
Action

↓

Cost

↓

Smart Contract

↓

Receipt
```

---

Scheduler

Only responsible for:

* Daily summaries
* Weekly summaries
* Reminders
* Billing reconciliation
* Maintenance

Nothing else.

---

# Smart Contract

Very simple.

One contract.

```
Wallet

↓

Deposit

↓

Balance

↓

Charge()

↓

Withdraw()

↓

Pause()

↓

Resume()
```

Each user owns one balance.

Functions:

```
deposit()

charge()

withdraw()

pause()

resume()

balanceOf()
```

No streaming math.

No escrow.

No DeFi.

---