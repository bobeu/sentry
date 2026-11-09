# Cron Watchdog Handoff

## Scope

- Incident / task:
- Deployment URL / ID:
- Intended project / team:
- Artifact root:
- Env file used, if any: file name only, no values

## Deployment Proof

- Local HEAD:
- Origin main:
- Live deployment/build signal:
- Project targeting proof:
- Mismatch or uncertainty:

## Runtime Path Diagram

```text
Vercel Cron tick -> /api/cron/watchdog auth -> runSandboxWatchdog
  -> deployment contract -> metadata read -> busy/stale/running/stopped branch
  -> cron wake key read -> ensureSandboxReady? -> token refresh
  -> OpenClaw cron jobs present in sandbox -> scheduled job executes -> delivery visible
```

| Edge | Status | Evidence |
|---|---|---|
| Vercel Cron invoked route | unknown | |
| Watchdog auth accepted | unknown | |
| Deployment contract passed | unknown | |
| Metadata branch correct | unknown | |
| Cron wake key due | unknown | |
| Sandbox wake/skip correct | unknown | |
| AI Gateway token refresh correct | unknown | |
| OpenClaw cron jobs present | unknown | |
| Scheduled job executed | unknown | |
| User-visible delivery happened | unknown | |

## Hypothesis Table

| Hypothesis | Evidence for | Evidence against | Fastest falsifier | Status |
|---|---|---|---|---|
| | | | | |

## Evidence Summary

- `/api/status`:
- `/api/admin/sandbox-diag`:
- `/api/admin/logs`:
- `/api/cron/watchdog` report:
- Store / cron wake evidence:
- Sandbox cron file shape:
- OpenClaw logs:
- Vercel logs:

## Verified-Bad Edge

- Edge:
- Why this is the first edge to fix:
- Evidence ruling out earlier edges:

## Proposed Fix Boundary

- Owner files:
- Shared files touched or explicitly avoided:
- Tests / live checks required:

## Verification

- Static / unit:
- Live before:
- Live after:
- Remaining unknowns:
