---
name: slack-delivery
description: "Slack channel specialist workflow: debug Slack OAuth vs delivery-ready, /slack/events fast path, raw-body signatures, route repair, boot-message cleanup, and lastForward."
---

# Slack Delivery

Use after `channel-debug-core` for Slack issues.

## Files

- `src/app/api/channels/slack/webhook/route.ts`
- `src/server/channels/slack/**`
- `src/server/workflows/channels/drain-channel-workflow.ts`
- `src/server/admin/why-not-ready.ts`
- `src/app/api/channels/summary/route.ts`

## Runtime Path

```text
Slack event -> /api/channels/slack/webhook -> Slack signature validation over raw body -> event/bot/subtype/user-message dedup -> fast path to port 3000 /slack/events OR workflow -> Bolt signature re-verification -> threaded Slack reply
```

## Parallel Lane Inputs To Consume

Before proposing a Slack fix, consume:

- Vercel/app logs lane: `channels.slack_webhook_accepted`, fast-path event, fallback/workflow event, requestId/deliveryId, and project targeting proof.
- Sandbox runtime lane: port 3000 listener, `/slack/events` probe behavior, OpenClaw plugin count, sanitized config has `channels.slack`.
- Workflow lane: `drainChannelWorkflow` run state when fast path skipped/failed, with verified project targeting when `.vercel/project.json` differs from the incident target.
- Prior-fix comparison: openclaw-42 zero-plugin wedge, stale sandbox URL, workflow retry exhaustion, Slack 401 raw-body/signature failure.

## Special Checks

- Raw body and `x-slack-*` headers must survive forwarding.
- Slack 401 from native handler usually means Bolt signature failure.
- OAuth complete is not delivery-ready.
- `liveConfigSync` failed can be overridden by recent accepted `lastForward`.
- Route repair after 404 must be proven with before/after signals.
- Pending boot message cleanup happens when bot reply events arrive.
- `app_mention` plus `message.channels` can duplicate user intent.
