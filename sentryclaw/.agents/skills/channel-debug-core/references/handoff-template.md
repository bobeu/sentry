# Channel Specialist Handoff: <channel>

## Scope

- Specialist:
- Channel:
- Task:
- Evidence artifact path:
- Lane:
- Parent incident artifact root:
- Release env file used: yes/no/name only
- Project targeting: intended project/team/deployment vs `.vercel/project.json` match/mismatch
- Correlation IDs: requestId / deliveryId / platformEventId / workflowRunId
- Files inspected:
- Files changed:

## Parallel Lane Status

| Lane | Owner | Artifact path | Status | Key signal |
|---|---|---|---|---|
| Vercel/app logs | | | pending/complete/unavailable | |
| Sandbox runtime | | | pending/complete/unavailable | |
| Workflow state | | | pending/complete/unavailable | |
| Channel specialist | | | pending/complete/unavailable | |

Merge gate satisfied? yes/no/unknown:
Reason:

## Deployment-State Proof

- Local HEAD:
- Remote main:
- Deployed/runtime proof:
- Mismatch? yes/no/unknown:

## Readiness Triad

- route-ready:
- native-accepted:
- user-visible-reply:

## Required Admin Surfaces

- why-not-ready:
- channels summary:
- sandbox diag:
- admin logs:
- requestId / deliveryId followed:

## Vercel Logs Evidence

- Deployment ID/URL inspected:
- Time window:
- `vercel logs` command shape used, no secrets:
- Project/team targeting proof:
- `.vercel/project.json` mismatch? yes/no/unknown:
- Request/delivery IDs found:
- Channel event sequence:
- Runtime log contradiction:

## Sandbox Runtime Evidence

- Sandbox ID source:
- Actual Vercel Sandbox ID:
- Rejected/ambiguous IDs, if any:
- `npx sandbox` result:
- App admin SSH/exec fallback used? yes/no:
- Process evidence:
- Port 3000 evidence:
- Port 8787 evidence:
- Sanitized config shape:
- OpenClaw log highlights:
- openclaw-42 comparison:

## Workflow Evidence

- `npx workflow inspect runs --backend vercel` result:
- Project/team targeting proof:
- Workflow run ID:
- Workflow status:
- Current/last step:
- Retries / repeated attempts:
- Terminal error:
- Fallback evidence if CLI unavailable:
- Correlates with `channels.forward_attempt` / `channels.forward_outcome`? yes/no/unknown:

## Runtime Path Diagram

```text
platform message -> app webhook route -> fast path? -> workflow? -> sandbox URL/port -> native handler -> platform reply
```

Mark each edge: `unknown`, `verified-good`, or `verified-bad`.

## Hypothesis Table

| Hypothesis | Evidence for | Evidence against | Fastest falsifier | Status |
|---|---|---|---|---|

## Prior Fix Comparison

| Prior fix / failure mode | Evidence match | Evidence mismatch | Conclusion |
|---|---|---|---|
| openclaw-42 zero-plugin gateway wedge | | | |
| stale sandbox URL / sandbox-not-listening | | | |
| workflow retry exhaustion | | | |
| channel signature/raw-body/secret failure | | | |
| accepted-forward override of stale configSync | | | |

## Terminal Path Audit

- Accepted path logs?
- Accepted path updates lastForward?
- Non-2xx path logs?
- Non-2xx path updates lastForward?
- Fetch/timeout path logs?
- Fetch/timeout path updates lastForward?
- Skipped/dedup/auth/invalid JSON path explains why?
- sandbox-not-listening refreshes stale port URL?

## Finding

- Verified bad edge:
- Root cause confidence:
- Why prior hypotheses were ruled out:

## Proposed Fix

- Minimal change:
- Shared-file ownership needed?
- Risk:

## Verification

- Automated:
- Manual:
- Before signal:
- After signal:

## Handoff / Escalation

- Needs parent decision:
- Needs another channel specialist:
- Do not proceed until:
