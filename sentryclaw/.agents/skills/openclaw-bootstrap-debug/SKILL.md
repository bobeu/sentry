---
name: openclaw-bootstrap-debug
description: "OpenClaw bootstrap, bundle, config, and restore-asset debugging for vercel-openclaw: openclaw.bundle sidecars, plugin discovery, channel catalog, restart scripts, config hashes, dynamic resume files, and fast restore. Use when setup, gateway boot, plugin loading, or bundle-sidecar compatibility fails."
---

# OpenClaw Bootstrap Debug

Use this skill when the sandbox exists but OpenClaw setup, bundle loading, gateway restart, plugin discovery, or config restoration is broken.

## Evidence First

Collect:

- `GET /api/admin/sandbox-diag` port probes.
- `GET /api/admin/logs` filtered for `gateway.`, `sandbox.`, `bootstrap.`, `restore.`.
- Sanitized `/home/vercel-sandbox/.openclaw/openclaw.json` shape.
- Process list and ports inside sandbox.
- Tail of `/tmp/openclaw/openclaw-*.log` with secrets redacted.
- Bundle URL and sidecar presence from wrapper logs/config, not by guessing.

## Common Failure Splits

- Bootstrap never completed vs fast restore failed.
- Bundle missing sidecar asset vs plugin discovery path wrong.
- Gateway process stale/defunct vs new process failed to bind port 3000.
- Config hash changed but dynamic resume files did not include the same fields.
- Channel catalog missing vs channel config invalid.
- Telegram `webhookSecret` missing from one config/hash/restore path.

## Fix Boundaries

- Config/restart: `src/server/openclaw/config.ts`.
- Bootstrap/assets: `src/server/openclaw/{bootstrap,restore-assets}.ts`.
- Lifecycle caller: `src/server/sandbox/lifecycle.ts`.
- Channel config sync: `src/server/channels/admin/apply-channel-config-change.ts`.
- Tests: bootstrap/config/restore tests plus affected channel readiness tests.

## Verification

```bash
node scripts/verify.mjs --steps=test,typecheck
lat check
```

For live fixes, include before/after gateway boot evidence: process list, port 3000 probe, plugin count or route registration, and relevant `gateway.restart_*` events.
