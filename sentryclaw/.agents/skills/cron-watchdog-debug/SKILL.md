---
name: cron-watchdog-debug
description: "Cron and watchdog debugging for vercel-openclaw: Vercel Cron auth, persisted OpenClaw jobs, cron wake keys, token refresh, restore oracle, hot spare, and watchdog reports. Use when scheduled OpenClaw jobs fail to wake or run, watchdog status is wrong, cron persistence is suspect, or /api/cron/watchdog behavior changes."
---

# Cron Watchdog Debug

Use this skill for cron wake, watchdog, scheduled OpenClaw job, and restore-oracle incidents.

## Non-Negotiables

Before proposing a fix, produce:

1. Deployment-state proof.
2. Watchdog path diagram with every edge marked `unknown`, `verified-good`, or `verified-bad`.
3. Hypothesis table with fastest falsifier and status.
4. Cron Watchdog Handoff.

Do not treat "cron route ran" as proof that an OpenClaw scheduled job ran. Keep these states separate: Vercel Cron invoked, watchdog authorized, persisted wake due, sandbox woke, AI Gateway token refreshed, OpenClaw cron scheduler loaded jobs, user-visible delivery happened.

## Evidence First

For live deployments, create one artifact root:

```bash
RUN_TS="$(date -u +%Y%m%dT%H%M%SZ)"
ART=".agent-runs/cron-debug/$RUN_TS"
mkdir -p "$ART"/{admin,vercel,sandbox,workflow}
```

Collect before editing code:

- `.vercel/project.json` versus the intended project/team/deployment.
- `git rev-parse HEAD` and `git ls-remote origin main`.
- Live `GET /api/status`.
- Live `GET /api/admin/sandbox-diag`.
- Live `GET /api/admin/logs` filtered for `watchdog.`, `sandbox.`, `gateway.`, `cron`, and `restore`.
- Live `GET /api/admin/launch-verify` if the incident involves launch readiness.
- Live `GET` or `POST /api/cron/watchdog` only with valid cron authorization.

If a release env file is supplied, source it only in the shell running live commands. Never print or save raw secrets.

## Watchdog Path Diagram

Use this shape and mark each edge:

```text
Vercel Cron tick -> /api/cron/watchdog auth -> runSandboxWatchdog
  -> deployment contract -> metadata read -> busy/stale/running/stopped branch
  -> cron wake key read -> ensureSandboxReady? -> token refresh
  -> OpenClaw cron jobs present in sandbox -> scheduled job executes -> delivery visible
```

For a running sandbox due soon, include the parallel branch:

```text
running sandbox -> gateway probe -> cronNextWakeMs <= now + 60s
  -> force AI Gateway token refresh -> restore oracle cycle -> no duplicate wake
```

## Runtime Probes

Read admin surfaces first. Then, only if needed, inspect the sandbox with `npx sandbox` or the app admin SSH/exec fallback.

Read-only sandbox checks:

```bash
set -eu
echo "== process =="
ps -eo pid,ppid,comm,args | grep -E "[o]penclaw|[n]ode" || true
echo "== ports =="
(ss -ltnp || netstat -ltnp) 2>/dev/null | grep -E ":(3000|8787)\\b" || true
echo "== cron files =="
ls -la /home/vercel-sandbox/.openclaw/cron 2>/dev/null || true
echo "== cron jobs shape =="
node - <<'NODE'
const fs = require('fs');
for (const p of [
  '/home/vercel-sandbox/.openclaw/cron/jobs.json',
  '/home/vercel-sandbox/.openclaw/cron/jobs-state.json',
]) {
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(p, JSON.stringify({
      version: j.version ?? null,
      jobCount: Array.isArray(j.jobs) ? j.jobs.length : Object.keys(j.jobs || {}).length,
      jobIds: Array.isArray(j.jobs) ? j.jobs.map((x) => x.id) : Object.keys(j.jobs || {}),
    }));
  } catch (err) {
    console.log(p, 'unreadable', err.message);
  }
}
NODE
```

Do not print job payload text if it may contain user data. Prefer shape, counts, ids, and next-run timestamps.

## Store Evidence

Cron wake depends on store keys written through the lifecycle layer. Do not hardcode Redis prefixes in app code. For debugging, use app/admin surfaces when available; if direct store inspection is unavoidable, record key names and redacted shapes only.

High-signal facts:

- `cronNextWakeMs` exists and is due, future, missing, or malformed.
- `cronJobsJson` structured record exists, has a SHA-256, job count, and source.
- `lastRestoreMetrics.cronRestoreOutcome` is present or missing after wake.
- `watchdog` report contains `cron.wake`, `token.refresh`, `probe`, and `restore.prepare` checks.

## Hypotheses To Compare

Keep all rows visible as they are ruled out:

| Hypothesis | Evidence for | Evidence against | Fastest falsifier | Status |
|---|---|---|---|---|
| Vercel Cron did not invoke the route | | | Vercel logs for `/api/cron/watchdog` | |
| Cron auth rejected the request | | | route response/log status 401 vs report | |
| Wake key was never persisted | | | store/admin evidence for `cronNextWakeMs` | |
| Wake key is future or stale | | | compare `cronNextWakeMs` to current UTC | |
| Watchdog intentionally skipped idle sandbox | | | `cron.wake` check message and metadata status | |
| Sandbox woke but token refresh failed | | | `token.refresh` check and AI Gateway token metadata | |
| Jobs file missing or malformed in sandbox | | | sanitized cron file shape from sandbox | |
| OpenClaw scheduler loaded jobs but delivery failed | | | OpenClaw logs plus channel lastForward/user-visible evidence | |
| Restore oracle or hot spare side effect changed cron state | | | `restore.prepare` check and restore metrics | |

## Safe Fix Boundaries

- `src/app/api/cron/watchdog/route.ts` owns cron-route auth and response shape.
- `src/server/watchdog/run.ts` owns watchdog decision order and report checks.
- `src/shared/watchdog.ts` owns report types.
- `src/server/sandbox/lifecycle.ts` owns cron persistence keys, stop/touch persistence, and wake behavior.
- `src/server/sandbox/cron-persistence.test.ts` and `src/server/watchdog/run.test.ts` own regression coverage.
- `lat.md/sandbox-lifecycle.md` owns the architecture narrative for cron wake.

Do not edit channel routes while debugging cron unless evidence proves the scheduled job reached channel delivery and failed there. Switch to the relevant channel skill for that phase.

## Verification

Pick the smallest verification that covers the changed edge:

```bash
node scripts/verify.mjs --steps=test,typecheck
node --test src/server/watchdog/run.test.ts
node --test src/server/sandbox/cron-persistence.test.ts
lat check
```

For live fixes, include before/after evidence from `/api/cron/watchdog`, `/api/admin/logs`, and sandbox cron file shape.

## Handoff

Use `references/handoff-template.md` for incident reports.
