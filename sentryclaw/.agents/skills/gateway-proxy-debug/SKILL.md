---
name: gateway-proxy-debug
description: "Gateway and proxy debugging for vercel-openclaw: /gateway routing, HTML injection, WebSocket rewrite, gateway-token handoff, waiting page, status heartbeat, sandbox port URL cache, and proxy auth. Use when the OpenClaw UI, WebSockets, gateway proxying, or waiting-page flow breaks."
---

# Gateway Proxy Debug

Use this skill when the wrapper can reach a sandbox but `/gateway`, HTML injection, WebSockets, or token handoff is broken.

## Evidence First

Collect:

- Browser URL and failing request path.
- `GET /api/status`.
- `GET /api/admin/sandbox-diag`.
- `GET /api/admin/logs` filtered for `proxy.`, `gateway.`, `sandbox.port_`, `token.`.
- Network trace for `/gateway/*`, WebSocket upgrade, and `POST /api/status` heartbeat.

Keep app auth, deployment protection bypass, gateway token, and AI Gateway auth separate. Do not paste gateway tokens in artifacts.

## Path Diagram

```text
browser -> wrapper auth -> /gateway route -> ensure sandbox running
  -> fresh gateway token -> sandbox port URL -> OpenClaw gateway
  -> HTML injection -> WebSocket rewrite -> heartbeat POST /api/status
```

Mark each edge `unknown`, `verified-good`, or `verified-bad`.

## Common Failure Splits

- Waiting page is correct because sandbox is not ready yet.
- Proxy auth failed before any sandbox request.
- Cached port URL is stale and needs invalidation.
- Gateway token is stale or not injected.
- HTML injection failed or produced a malformed script.
- WebSocket URL rewrite points at the wrong origin/path.
- Heartbeat is missing and sandbox times out.

## Fix Boundaries

- Primary: `src/app/gateway/[[...path]]/route.ts`.
- Helpers: `src/server/proxy/{proxy-route-utils,htmlInjection,waitingPage}.ts`.
- Lifecycle dependencies: `src/server/sandbox/lifecycle.ts`, `src/server/public-url.ts`.
- Tests: proxy/html injection tests plus lifecycle tests for heartbeat interactions.
- Docs: `lat.md/sandbox-lifecycle.md`, `docs/architecture.md`, `docs/deployment-protection.md`.

## Verification

Run focused tests when available, then:

```bash
node scripts/verify.mjs --steps=test,typecheck
lat check
```

For UI/WebSocket fixes, verify in a browser or with a smoke check that HTML contains the injected script and WebSocket traffic reaches the sandbox.
