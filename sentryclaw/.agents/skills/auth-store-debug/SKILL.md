---
name: auth-store-debug
description: "Auth and store debugging for vercel-openclaw: admin-secret mode, Sign in with Vercel, session cookies, CSRF, LOCAL_READ_ONLY, Redis vs memory store, keyspace namespacing, and metadata shape migrations. Use when login, route authorization, Redis persistence, or metadata state is suspect."
---

# Auth Store Debug

Use this skill when request authorization, session behavior, store persistence, or metadata shape is the likely problem.

## Evidence First

Collect:

- Auth mode and Vercel/local environment from admin/preflight surfaces.
- Request method, route, status, and whether bearer or cookie auth was used.
- `GET /api/admin/logs` filtered for `auth.`, `store.`, `session.`, `preflight.`.
- Store backend reported by deployment contract.
- Sanitized metadata shape when needed. Never print secrets, session keys, Redis URLs, or cookies.

## Critical Splits

- Deployment Protection auth vs app auth.
- Bearer admin-secret auth vs encrypted session cookie auth.
- CSRF applies to cookie-based mutations, not bearer mutations.
- `LOCAL_READ_ONLY=1` intentionally blocks admin mutations locally.
- Redis connects only on deployed Vercel runtimes; local/CI use memory store even if Redis envs exist.
- `OPENCLAW_INSTANCE_ID` changes namespace and does not migrate old state.

## Fix Boundaries

- Auth: `src/server/auth/{admin-auth,admin-secret,session,vercel-auth,route-auth}.ts`.
- Store: `src/server/store/{store,redis-store,memory-store,keyspace}.ts`, `src/shared/types.ts`.
- Routes: only the affected route handler.
- Docs/env contract: `.env.example`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`.

## Verification

```bash
node scripts/verify.mjs --steps=test,typecheck
pnpm check:verify-contract
lat check
```

Run `pnpm check:verify-contract` when env vars, auth mode docs, or operator instructions change.
