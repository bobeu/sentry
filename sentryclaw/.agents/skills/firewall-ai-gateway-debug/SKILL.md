---
name: firewall-ai-gateway-debug
description: "Firewall and Vercel AI Gateway debugging for vercel-openclaw: network policy allowlists, OIDC token refresh, AI Gateway transform rules, firewall learning/enforcement, and sandbox.update networkPolicy calls. Use when model calls, egress, token refresh, or firewall policy application fails."
---

# Firewall AI Gateway Debug

Use this skill for model-call failures, egress blocks, network policy drift, or AI Gateway token refresh problems.

## Evidence First

Collect:

- `GET /api/admin/preflight` or launch verification preflight evidence.
- `GET /api/admin/logs` filtered for `firewall.`, `token.`, `gateway.`, `watchdog.`.
- `GET /api/admin/sandbox-diag`.
- Current firewall mode and learned/allowed domains from admin surfaces.
- Sanitized model-call or gateway error body. Do not print Authorization tokens.

## Critical Splits

- AI Gateway credential unavailable vs expired vs circuit-breaker-open.
- Static API key bypass vs OIDC token path.
- Firewall learning/allowlist issue vs model provider/API issue.
- `OPENAI_BASE_URL` inside sandbox is present, while Authorization is injected by network policy transform.
- Policy object shape changes when an AI Gateway token exists.

## Invariants

- AI Gateway token never enters sandbox files or env.
- `ai-gateway.vercel.sh` stays allowed even in enforcing mode.
- Token refresh applies `sandbox.update({ networkPolicy })`; it should not rewrite config files or restart the gateway.
- Public/admin display URLs must not expose deployment-protection bypass secrets.

## Fix Boundaries

- Primary: `src/server/firewall/{domains,policy,state}.ts`.
- Token path: `src/server/sandbox/lifecycle.ts`, `src/server/deploy-preflight.ts`.
- Public URLs: `src/server/public-url.ts`.
- Tests: firewall policy tests, token refresh tests, launch-verify/preflight tests.
- Docs: `docs/environment-variables.md`, `docs/deployment-protection.md`, `lat.md/sandbox-lifecycle.md`.

## Verification

```bash
node scripts/verify.mjs --steps=test,typecheck
lat check
```

For live incidents, prove a model call succeeds after the policy/token change and that no token value appears in logs, UI, or sandbox config.
