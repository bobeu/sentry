# Script Audit

This audit records the post-cleanup script surface and why each remaining script clears the agent-utility bar.

Refreshed on 2026-05-08 after deleting stale benchmarks, old local harnesses, direct Redis reset helpers, and one-off `scripts/experiments/` probes. The remaining scripts must be either canonical automation, current incident tooling with a specialist owner, guarded operator recovery, or release/runtime maintenance.

## Removed Scripts

These scripts were removed because they were stale, duplicated maintained paths, depended on old OpenClaw/Sandbox assumptions, or were not useful enough for agents to keep as runnable defaults.

| Removed script | Last touch | Why removed |
| --- | --- | --- |
| `scripts/bench-bundle-bootstrap.mjs` | `bd808a8` 2026-04-30 | Duplicated current lifecycle/launch checks and still modeled older install-vs-bundle benchmarking. Agents should use live launch/bootstrap evidence instead. |
| `scripts/bench-sandbox-direct.mjs` | `d75d2db` 2026-04-07 | Older raw SDK benchmark with duplicated sandbox path constants and old bootstrap assumptions. `bench-sdk-snapshot` is the maintained direct SDK timing tool. |
| `scripts/benchmark-restore.mjs` | `e4f3f19` 2026-04-01 | Older destructive restore benchmark predating later restore-oracle/hot-spare work. Agents should use launch verification and lifecycle diagnostics. |
| `scripts/benchmark-telegram-wake-versions.mjs` | `07f54ae` 2026-04-13 | Local version sweep depended on the removed vgrok harness and pre-May Telegram behavior. Not a good live-incident agent default. |
| `scripts/bun-verify.sh` | `398c86c` 2026-03-18 | Bun gateway experiment predating the current sidecar bundle path. |
| `scripts/exec-local-bin.mjs` | `acfef12` 2026-04-17 | Tiny CI helper with no current package/docs/agent caller. |
| `scripts/measure-openclaw-telegram-startup.mjs` | `9b93fe9` 2026-04-13 | Local startup measurement predating current Telegram fast-path/listener fixes. Live agents need runtime evidence, not local timing guesses. |
| `scripts/reset-meta.mjs` | `9ebd13f` 2026-04-16 | Direct Redis metadata mutation bypassed app invariants. Prefer admin reset/recovery routes and explicit operator workflows. |
| `scripts/reset.sh` | `bd808a8` 2026-04-30 | Had a stale default deployment URL and duplicated typed admin calls. Too risky as an agent default. |
| `scripts/smoke-redis-store.mjs` | `81ffdbb` 2026-04-17 | Direct Redis smoke is covered by store tests/contract checks and is risky against live Redis. |
| `scripts/smoke-telegram-restore.mjs` | `07f54ae` 2026-04-13 | Deep Telegram restore harness predating later fast-path and workflow diagnostics. Agents should use channel-debug lanes and maintained wake smoke. |
| `scripts/test-telegram-wake-local.mjs` | `9b93fe9` 2026-04-13 | Large vgrok/local workflow harness with old assumptions and package override behavior. Removed to avoid agents using stale local evidence as runtime proof. |
| `scripts/experiments/*` | mostly `33302b9` 2026-03-19; some `f93de2e` 2026-04-18 | One-off SDK/Bun/snapshot experiments. Useful history belongs in git, not as runnable agent surface. |

## Remaining Scripts

| Script | Last touch | Class | Why it is worth keeping | Agent owner |
| --- | --- | --- | --- | --- |
| `scripts/audit-dead-channel-queue-surface.mjs` | `22380a6` 2026-03-20 | Canonical | Guards that stale channel queue surfaces do not return after the Workflow DevKit migration while launch verification queue use remains allowlisted. It is run through `verify.mjs`. | `launch_verify`, channel workflows. |
| `scripts/audit-verifier-surface.mjs` | `bd808a8` 2026-04-30 | Canonical | Enforces pnpm-first discovery surfaces and catches stale host-side `npm`/`tsx` guidance. Updated to remove allowlists for deleted benchmark/experiment scripts. | Broad verification. |
| `scripts/bench-sdk-snapshot.mjs` | `79c0b62` 2026-05-06 | Operational | Maintained direct Vercel Sandbox stop-to-stopped benchmark with bundle workload support matching the current runtime artifact path. | `sandbox_lifecycle`. |
| `scripts/bench-stop-cycle.mjs` | `bd808a8` 2026-04-30 | Operational | Measures deployed app stop/snapshot behavior and can include SDK polling to distinguish host-visible stopped from platform truth. | `sandbox_lifecycle`. |
| `scripts/check-deploy-readiness.mjs` | `9ebd13f` 2026-04-16 | Operational | Remote deployment readiness gate that regenerates the protected-route manifest and validates `/api/admin/launch-verify` contract. | `launch_verify`. |
| `scripts/check-queue-consumers.mjs` | `39c4126` 2026-03-20 | Canonical | Small guard that the only intentional queue consumer route is launch verification. `verify.mjs` runs it before tests. | `launch_verify`. |
| `scripts/check-verifier-contract.mjs` | `bd808a8` 2026-04-30 | Canonical | Enforces operator docs/env/verifier contract and package manager invariants that are easy for agents to drift. | `auth_store`, env/docs work, all agents via verification. |
| `scripts/generate-protected-route-manifest.mjs` | `b5256e8` 2026-03-20 | Canonical | Generates and validates protected admin/firewall/debug route coverage. Also used by deployment readiness. | `auth_store`, `launch_verify`. |
| `scripts/release-lifecycle-lock.mjs` | `d913062` 2026-04-17 | Guarded recovery | Inspects and, only when explicitly requested, releases scoped lifecycle/start/init/token locks. It supports `--dry-run` and requires explicit Redis/instance context. | `sandbox_lifecycle`, `cron_watchdog`. |
| `scripts/slack-debug-send.mjs` | `d039913` 2026-05-08 | Operational | Sends a real user-authored Slack debug message with token identity guardrails and sanitized artifacts for live channel correlation. | `channel_slack`, Vercel logs, Workflow state. |
| `scripts/test-slack-wake.mjs` | `b9c4110` 2026-04-17 | Operational | Autonomous Slack stopped-sandbox wake smoke using current channel-secrets and channel-forward diagnostics. Synthetic mode is regression evidence, not UI proof. | `channel_slack`, Workflow state. |
| `scripts/test-telegram-wake.mjs` | `07f54ae` 2026-04-13 | Operational | Autonomous Telegram stopped-sandbox wake smoke against deployed targets using current admin channel-secrets and channel-forward diagnostics. Synthetic mode is not user-visible proof. | `channel_telegram`, Workflow state. |
| `scripts/test.mjs` | `866e698` 2026-03-27 | Canonical | Repo-aware test runner with TypeScript import setup and serial `node:test` execution. Avoids misleading raw `node --test` alias failures. | All agents. |
| `scripts/vendor-openclaw-runtime-artifact.mjs` | `9b93fe9` 2026-04-13 | Release/runtime maintenance | Vendors the sibling OpenClaw runtime artifact, verifies SHA-256, and regenerates the typed runtime artifact module. | `openclaw_bootstrap`. |
| `scripts/verify-package-manager.mjs` | `ac86321` 2026-04-16 | Canonical | Focused host package-manager guard; complements verifier contract checks. | Broad verification. |
| `scripts/verify.mjs` | `7f592f9` 2026-03-15 | Canonical | Canonical CI/automation entrypoint with structured events and queue-consumer pre-step. | All agents. |

## Skill Helper Scripts

| Script | Last touch | Class | Why it is worth keeping | Agent owner |
| --- | --- | --- | --- | --- |
| `.agents/skills/channel-debug-core/scripts/collect-channel-evidence.sh` | `e70bffd` 2026-05-07 | Operational | Collects the required channel admin surfaces and git proof into a channel debug artifact directory. It is a helper for, not a replacement for, the Vercel logs, sandbox runtime, workflow, and channel specialist lanes. | `$channel-debug-core`. |

## Package Scripts

| Package script | Command | Class | Why it is worth keeping |
| --- | --- | --- | --- |
| `dev` | `next dev` | Canonical | Local Next.js development server. |
| `build` | `next build` | Canonical | Production build step covered by the verifier. |
| `start` | `next start` | Canonical | Production start for local build output. |
| `lint` | `eslint src` | Canonical | Source lint step. |
| `typecheck` | `tsc --noEmit` | Canonical | App TypeScript check. |
| `typecheck:build` | `tsc --noEmit -p tsconfig.build.json` | Canonical | Build-specific TypeScript config check. |
| `test` | `node scripts/test.mjs` | Canonical | Repo-aware test runner. |
| `test:watch` | `node scripts/test.mjs --watch` | Developer convenience | Watch mode for the repo-aware test runner. |
| `smoke:remote` | `tsx src/server/smoke/remote-smoke.ts` | Operational | Remote smoke entrypoint for deployed launch/readiness checks. |
| `slack:debug-send` | `node scripts/slack-debug-send.mjs` | Operational | Package alias for the current Slack debug sender. |
| `test:telegram-wake` | `node scripts/test-telegram-wake.mjs` | Operational | Package alias for deployed Telegram wake smoke. |
| `verify` | `node scripts/verify.mjs` | Canonical | Canonical CI/automation entrypoint. |
| `verify:package-manager` | `node scripts/verify-package-manager.mjs` | Canonical | Host package-manager contract guard. |
| `check:verify-contract` | `node scripts/check-verifier-contract.mjs` | Canonical | Operator docs/env/verifier contract guard. |
| `audit:verifier-surface` | `node scripts/audit-verifier-surface.mjs` | Canonical | Pnpm-first discovery-surface audit. |
| `audit:dead-channel-queue-surface` | `node scripts/audit-dead-channel-queue-surface.mjs` | Canonical | Stale channel queue surface audit. |
| `check:deploy-readiness` | `node scripts/check-deploy-readiness.mjs` | Operational | Deployment readiness wrapper around protected route manifest and launch verification. |
| `test:launch-verify` | `node --import tsx --test src/app/api/admin/launch-verify/route.test.ts` | Canonical | Focused launch verification route test. |
| `test:preflight` | `node --import tsx --test src/server/deploy-preflight.test.ts` | Canonical | Focused deployment preflight test. |
| `test:deploy-requirements` | `node --import tsx --test src/server/deploy-requirements.test.ts` | Canonical | Focused deploy requirements test. |
| `test:lifecycle` | `node --import tsx --test src/server/sandbox/lifecycle.test.ts` | Canonical | Focused sandbox lifecycle test. |
| `verify:observability-pass` | `pnpm run test:launch-verify && pnpm run test:preflight && pnpm run test:deploy-requirements && pnpm run test:lifecycle` | Canonical | Focused observability regression bundle. |
| `prepare` | `husky` | Canonical | Git hook installer. |
