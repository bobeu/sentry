# Volume scripts (Celo mainnet)

Local-only tooling lives in `smartContracts/tests/` (gitignored).

1. Populate `smartContracts/tests/accounts.json`:

```json
[
  { "address": "0x...", "private_key": "0x..." }
]
```

2. From `smartContracts/`:

```bash
npm run vol:help
npm run vol:connect
npm run vol:transfer -- --count 5 --wait 2000 --amount 0.0001 --currency celo
npm run vol:volume -- --count 10 --wait 1000 --amount 0.0001 --loop 3
npm run vol:charge -- --count 2 --wait 3000 --currency USDm --amount 0.01
```

Every write uses ERC-8021 attribution `celo_e3cc4c8d8a0e` via `lib/attribution.ts` (same as `ui/lib/attribution.ts`). RPC defaults to `https://forno.celo.org` (mainnet only).

Privileged factory/manager calls need the matching owner/operator key in `accounts.json` (or `SENTRY_OWNER_KEY` / `SENTRY_OPERATOR_KEY` in `.env`).
