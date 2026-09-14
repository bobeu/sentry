# Sentry Employee Tool API (OpenClaw contract)

Base: `POST /api/agent/v1/tasks`  
Auth: `Authorization: Bearer sk_sentry_…` (employer Agent API key — who pays)  
Caller context: always send `telegramUserId` (who is speaking). Add `chatId` / `groupId` for group work.

## Auth model


| Identity         | Meaning                                                |
| ---------------- | ------------------------------------------------------ |
| Agent API key    | Employer account that funds billable tools             |
| `telegramUserId` | End user on Telegram (member / employer / grand admin) |
| Grand admin      | Telegram id `805099765` — AskBot + analytics only      |


Deterministic rules (employment Active, balance, group enabled, admin checks) are enforced **in Sentry**, never trusted from the LLM alone.

## Tasks


| Task                            | Billable    | Notes                                        |
| ------------------------------- | ----------- | -------------------------------------------- |
| `status`                        | yes         | Employment, enabled groups, balance          |
| `resolve_identity`              | no          | Link Telegram → employer                     |
| `get_context`                   | yes         | Recent messages, FAQs, group config          |
| `summarize_thread`              | yes         | Needs `groupId`                              |
| `answer_faq` / `generate_reply` | yes         | Needs `groupId` + `question`                 |
| `wallet_status`                 | yes         | Employer wallet / deposit                    |
| `list_groups`                   | yes         | Employer's groups                            |
| `points_status`                 | yes         | Member points in group                       |
| `moderation`                    | via service | `moderationAction` + `targetUserId`          |
| `start_engagement`              | yes         | Invents unique poll/trivia/fun/campaign and posts native Telegram poll/quiz |
| `engagement_event`              | no          | Register poll vote / quiz tap / typed choice |
| `engagement_status`             | no          | List active activities + options             |
| `employer_help`                 | yes         | Menu + capabilities (+ inline keyboard JSON) |
| `remember` / `forget`           | yes/partial | Member memory                                |
| `askbot`                        | no          | Grand admin only                             |
| `analytics_overview`            | no          | Grand admin only                             |




## Telegraf parity

`[ui/telegram/handlers.ts](../telegram/handlers.ts)`, `[commands.ts](../telegram/commands.ts)`, and employer DM inline buttons remain in place during migration. OpenClaw calls this API; product logic stays shared via services.

## Cutover

1. Pilot `@tgemployeebot` (SentryClaw) in test groups.
2. Point employers at the new bot.
3. Delete `@tgemployee_bot` in BotFather when parity is accepted.
4. Keep Agent API key on SentryClaw for employer billing attribution.

