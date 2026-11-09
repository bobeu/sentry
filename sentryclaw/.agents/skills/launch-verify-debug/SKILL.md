---
name: launch-verify-debug
description: "Launch verification and remote smoke debugging for vercel-openclaw: preflight, queue ping, ensureRunning, chatCompletions, wakeFromSleep, restorePrepared, channelReadiness, NDJSON progress, and vclaw create readiness. Use when launch verification, vclaw create validation, or remote smoke checks fail."
---

# Launch Verify Debug

Use this skill for `/api/admin/launch-verify`, `pnpm smoke:remote`, and `vclaw create` readiness failures.

## Evidence First

Collect:

- Request mode: destructive or read-only, JSON or NDJSON.
- Full phase payload with secrets redacted.
- `GET /api/admin/preflight` and persisted `GET /api/admin/launch-verify` when available.
- `GET /api/channels/summary` for channel readiness.
- `GET /api/admin/logs` filtered for `launch.`, `preflight.`, `sandbox.`, `gateway.`, `channels.`.

## Phase Splits

Report each phase separately:

- preflight
- queuePing
- ensureRunning
- chatCompletions
- wakeFromSleep
- restorePrepared
- channelReadiness

Do not collapse `ready:false` into one root cause. `failingChannelIds` is the machine-readable channel failure list; `warningChannelIds` is deprecated.

## Fix Boundaries

- Preflight: `src/server/deploy-preflight.ts`, `src/app/api/admin/preflight/route.ts`.
- Launch verify: `src/app/api/admin/launch-verify/route.ts`, `src/app/api/queues/launch-verify/route.ts`.
- Smoke: `src/server/smoke/remote-smoke.ts`, `src/server/smoke/remote-phases.ts`.
- Restore phase: `src/server/sandbox/restore-oracle.ts` and lifecycle callers.

## Verification

```bash
node scripts/verify.mjs --steps=test,typecheck
pnpm smoke:remote --base-url <url> [--destructive] [--auth-cookie "session=..."]
lat check
```

For live launch fixes, include the terminal launch verification payload and the exact failed phase before/after.
