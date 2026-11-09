---
name: admin-ui-debug
description: "Admin UI and operator surface debugging for vercel-openclaw: command shell design, admin actions, request core, status panels, launch verification UI, channel readiness UI, and local read-only production-data workflows. Use when the root admin UI, controls, visual state, or operator copy is wrong."
---

# Admin UI Debug

Use this skill when the root admin control surface or operator-facing UI behavior is the focus.

## Evidence First

Collect:

- Screenshot or browser reproduction path.
- API payloads the UI consumes: `/api/status`, `/api/channels/summary`, launch verify, preflight, logs.
- Browser console errors.
- Whether `LOCAL_READ_ONLY=1` is set.
- Mobile and desktop viewport checks for layout changes.

## Design Constraints

This is an operator control surface, not a marketing dashboard. Keep it dense, dark-only, Vercel-native, and restrained. Avoid decorative cards, ornamental color, and copy that explains obvious controls.

Use existing components and patterns before adding abstractions. Keep text small enough for compact panels and ensure button/card text cannot overflow.

## Fix Boundaries

- UI: `src/components/designs/command-shell.tsx`.
- Action/request helpers: `src/components/admin-{action,request}-core.ts`.
- API shape changes: affected route/shared type only.
- Design reference: `.impeccable.md`.

## Verification

Run focused tests/typecheck and, for visual changes, use browser verification or screenshots:

```bash
node scripts/verify.mjs --steps=test,typecheck
lat check
```

When a dev server is needed, start it and report the URL.
