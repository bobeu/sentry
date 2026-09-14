# [Buy Beta] reproducible failure: <short summary> — Sentry

## Summary

- **What happened:** (short description)
- **Date (UTC):** 2026-09-14T__Z
- **Agent / public wallet:** 0x................................ (public address only)

## Steps to reproduce

1. Install / setup: `npx --yes @celo/buy setup --name buy` then `npx --yes @celo/buy mcp install --client all`
2. Quote: `npx --yes @celo/buy quote --provider google --machine "e2-medium" --duration "1h" --image "ubuntu-22.04" --network mainnet`
   - Quote JSON: (paste)
3. Fund facilitator address: `<facilitator_address>` with `<amount> USDC` — tx: `<tx-hash>` (explorer link)
4. Pay: `npx --yes @celo/buy pay --settlement <SETTLEMENT_ID>` — CLI output: (paste)
5. Wait for settlement confirmation — observed: (paste behavior or error)
6. SSH: `ssh ubuntu@<vm-host>` — ssh output: (paste)
7. Workload: (commands run) — results: (stdout/stderr)

## Observed result

- Exact CLI error messages, HTTP status codes, or stderr output
- Timestamps: quote returned at T1, pay tx at T2, settlement confirmed at T3, SSH attempt at T4

## Expected result

- Quick settlement confirmation and reachable VM within N minutes; charged amount should match the quote; clear CLI error codes on failure

## Evidence (attach)

- `quote.json`
- `settlement.json`
- `settlement-status.log`
- `ssh-run.log`
- Funding tx hash + explorer link

## Impact

- How this blocks buyer-side testing and adoption

## Suggested fixes

- Add clearer status transitions for reserved → confirmed → running
- Expose machine console logs on failure via `buy status` or an API endpoint
- Improve CLI error messages when payment reservation succeeds but allocation stalls

## Redactions

- Private keys, Self proofs and polling/private endpoints redacted. Public tx hashes included.
