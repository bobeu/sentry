---
name: channel-debug-core
description: "Channel webhook triage for vercel-openclaw Slack/Telegram/Discord/WhatsApp issues: prove deployment state, collect admin readiness endpoints, build evidence-first handoff before fixes."
---

# Channel Debug Core

Use this skill for any Slack, Telegram, Discord, or WhatsApp delivery issue.

## Non-Negotiables

Before proposing a fix, produce:

1. Deployment-state proof.
2. Runtime path diagram with each edge marked `unknown`, `verified-good`, or `verified-bad`.
3. Hypothesis table with fastest falsifier and status.
4. Channel Specialist Handoff.

Do not write "most likely" twice. Gather direct evidence.

## Parallel First Rule

For live deployments, channel debugging starts with parallel lanes. The parent agent creates one artifact root and launches these lanes before any patch proposal:

| Lane | Agent role | Evidence focus |
|---|---|---|
| Vercel/app logs | `channel_vercel_logs` | Project targeting proof, deployment proof, admin readiness JSON, Vercel runtime logs, request/delivery correlation |
| Sandbox runtime | `channel_sandbox_runtime` | `npx sandbox` or app admin SSH fallback, process/port/config/log evidence |
| Workflow state | `channel_workflow_state` | Project targeting proof, `npx workflow inspect runs --backend vercel`, drain workflow state, fallback log correlation |
| Channel specialist | `channel_<channel>` | Channel route semantics, signatures/raw body, dedup, boot message, terminal-path audit |

No fix may be proposed until the merge gate is satisfied:

1. Each lane has returned a handoff, or the lane is marked unavailable with the attempted fallback.
2. At least one runtime edge is `verified-bad`.
3. Contradictory lane evidence has been added to the hypothesis table.
4. Prior known fixes have been compared against current evidence.

## Project Targeting Preflight

Before any `vercel`, `npx sandbox`, or `npx workflow` investigation, prove the command is targeting the intended Vercel project and team.

Always inspect `.vercel/project.json` and compare it to the incident target. If they differ, do not rely on inferred project context. Use explicit project/team/deployment targeting and record the mismatch in the handoff.

Known sharp edge: this repo may be linked to release 45 in `.vercel/project.json` (`projectName: vercel-openclaw-45`, `projectId: prj_ag6Uzj9b4deNK98jVS5SO0H2Shmx`). For release 46, use explicit target context (`projectName: vercel-openclaw-46`, `projectId: prj_JSzrXyJiMzT6F7BUA76Naa7nkjRa`, team `vercel-internal-playground`) rather than trusting `.vercel` inference.

If a tool prints that it inferred the project from `.vercel`, treat the output as suspect until the inferred project is proven to match the incident target. This is especially important for `npx workflow`, which can silently inspect the wrong project when run from a repo linked to a different release.

## Required Admin Surfaces

Collect these first:

```bash
GET /api/admin/why-not-ready
GET /api/channels/summary
GET /api/admin/sandbox-diag
GET /api/admin/logs
```

Save the raw JSON before continuing. Logs are a ring buffer and can evict important events.

## Readiness Triad

Report these separately:

- `route-ready`: platform route/native route appears registered.
- `native-accepted`: `lastForward.ok` true with `classification:"accepted"`, or equivalent handler acceptance evidence.
- `user-visible-reply`: real user saw a Slack/Telegram/Discord/WhatsApp reply or status update.

Never collapse these into `connected`.

## Deployment Proof

Run or request equivalent evidence:

```bash
git rev-parse HEAD
git ls-remote origin main
curl "$URL/api/admin/sandbox-diag"
```

If the deployed runtime cannot be tied to the source being read, say so and stop code-level conclusions.

## Evidence Artifact Rule

Write evidence under:

```text
.agent-runs/channel-debug/<timestamp>/<channel>/
```

Do not commit runtime evidence. Redact admin secrets, bypass secrets, bot tokens, webhook secrets, and platform access tokens.

## Release Env Files

When the incident references a release-specific env file, such as `.env.45`, use it only to investigate that release's live run.

Allowed uses:

- deployment URL / app URL
- Vercel project/team/deployment context
- Vercel token for logs/workflow/sandbox CLI
- `ADMIN_SECRET`
- Deployment Protection bypass
- platform credentials required to verify the specific channel run

Rules:

- Source the file; do not print it.
- Do not copy it into artifacts.
- Do not include raw values in handoffs.
- Record only the file name and variable names used.
- Treat env files as credential/context input, not deployment proof. Deployment proof still comes from git, project targeting proof, and live runtime signals.

## Sandbox Runtime Probe

The sandbox lane must first identify the actual Vercel Sandbox runtime ID. Use `/api/admin/sandbox-diag` and `/api/channels/summary` before CLI access.

If the ID is `oc-prj*`, `prj_*`, `OPENCLAW_INSTANCE_ID`, or `VERCEL_PROJECT_ID`, do not pass it as `<sandbox_id>` to `sandbox exec` or `sandbox connect`.

When `npx sandbox` / `sandbox` works, collect read-only evidence:

```bash
sandbox exec "$SANDBOX_ID" sh -lc '
  set -eu
  echo "== process =="
  ps -eo pid,ppid,comm,args | grep -E "[o]penclaw|[n]ode" || true
  echo "== ports =="
  (ss -ltnp || netstat -ltnp) 2>/dev/null | grep -E ":(3000|8787)\\b" || true
  echo "== openclaw logs =="
  tail -200 /tmp/openclaw/openclaw-*.log 2>/dev/null || true
'
```

For config, print only shape, never secrets:

```bash
sandbox exec "$SANDBOX_ID" node - <<'NODE'
const fs = require("fs");
const p = "/home/vercel-sandbox/.openclaw/openclaw.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
console.log(JSON.stringify({
  channels: Object.keys(j.channels || {}),
  pluginAllow: j.plugins?.allow || null,
  hasSlack: Boolean(j.channels?.slack),
  hasTelegram: Boolean(j.channels?.telegram),
  hasDiscord: Boolean(j.channels?.discord),
  hasWhatsApp: Boolean(j.channels?.whatsapp),
}, null, 2));
NODE
```

If CLI access fails because the ID is incompatible or auth cannot resolve the sandbox, save the CLI failure and switch to the app admin SSH/exec fallback. The fallback must run the same read-only probes.

## Workflow State Probe

The workflow lane must inspect Vercel Workflow state before treating the workflow path as healthy or broken:

```bash
npx workflow inspect runs --backend vercel > "$ART/workflow/runs.txt" 2> "$ART/workflow/runs.stderr.txt"
```

Correlate by channel, incident time, request ID, delivery ID, platform event ID, and `drainChannelWorkflow`.

Collect workflow run ID, status, current/last step, retry count or repeated step evidence, terminal error, whether native forward attempts happened, and whether `channels.forward_outcome` was written.

If `npx workflow` is unavailable or cannot inspect Vercel state, save the failure and fall back to Vercel logs filtered to workflow/channel events, `/api/admin/logs`, and `/api/channels/summary.lastForward`. Do not use local workflow data as evidence for production behavior.

## Prior Fix Comparison

Before proposing a patch, compare current evidence to known prior fixes and failure signatures:

| Prior fix / failure mode | Current matching evidence | Current contradicting evidence | Match? |
|---|---|---|---|
| openclaw-42 zero-plugin gateway wedge | | | |
| stale sandbox public URL / sandbox-not-listening | | | |
| workflow retry exhaustion | | | |
| route-ready vs native-accepted mismatch | | | |
| recent accepted-forward override of stale configSync failure | | | |
| channel-specific signature/raw-body/secret issue | | | |

A repeated operator-facing message is not enough. Match on runtime signals: status codes, route probes, process/log evidence, Workflow state, and `lastForward`.

## Fallback When Live Access Is Unavailable

If you cannot call the deployed endpoints, produce a static code-path audit and mark runtime edges `unknown`. Do not claim runtime behavior from code alone.
