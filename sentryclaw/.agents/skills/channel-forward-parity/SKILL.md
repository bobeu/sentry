---
name: channel-forward-parity
description: "Webhook route parity audit for channel delivery changes: ensure terminal paths log, record lastForward, classify failures, and refresh stale sandbox port URLs."
---

# Channel Forward Parity

Use this before modifying any channel webhook route or the shared drain-channel workflow.

## Source Files To Audit

- `src/server/channels/last-forward.ts`
- `src/server/workflows/channels/drain-channel-workflow.ts`
- `src/app/api/channels/slack/webhook/route.ts`
- `src/app/api/channels/telegram/webhook/route.ts`
- `src/app/api/channels/discord/webhook/route.ts`
- `src/app/api/channels/whatsapp/webhook/route.ts`
- `src/app/api/channels/summary/route.ts`
- `src/server/admin/why-not-ready.ts`

## Required Output

Produce a table:

| Channel | Branch | Logs event | Updates lastForward | Classification | Stale URL refresh | Evidence |
|---|---|---|---|---|---|---|

Also include correlation coverage:

| Channel | Branch | requestId/deliveryId propagated | workflowRunId propagated | Logs event | Updates lastForward | Classification | Stale URL refresh | Evidence |
|---|---|---|---|---|---|---|---|---|

## Rules

- Every delivery attempt must update `lastForward`.
- Every skip/reject branch must log a structured reason.
- Workflow forwarding already records `lastForward`; do not double-record above it.
- Treat route-ready, native-accepted, and user-visible-reply separately.
- Do not add info-level logs on hot polling paths unless operationally necessary; ring-buffer eviction hides evidence.
- Never add `export const runtime = "nodejs"` to route handlers.
- For workflow handoff branches, verify that `channels.<ch>_workflow_started`, `channels.forward_attempt`, and `channels.forward_outcome` can be correlated by requestId/deliveryId and workflowRunId when available.
- If `npx workflow` cannot inspect the run, parity evidence must fall back to Vercel logs plus `/api/admin/logs`.
- Do not accept "workflow started" as proof of native acceptance; require forward attempt/outcome or user-visible reply evidence.
- Do not accept `npx sandbox` failure as sandbox-unreachable until the app admin SSH/exec fallback has been attempted or marked unavailable.
- Verify project targeting before trusting `vercel`, `npx workflow`, or `npx sandbox` output. If `.vercel/project.json` points at a different release, require explicit project/team/deployment targeting evidence.

## Current Audit Seeds

- Check Slack fast-path fetch-exception branches for `recordChannelLastForward` coverage.
- Check Telegram unauthorized, invalid JSON, and dedup branches for structured logs where operator evidence is needed.
- Check WhatsApp duplicate/skip branches for structured logs and clear classifications.
- Check every `sandbox-not-listening` branch for exactly one stale-port refresh per request.
