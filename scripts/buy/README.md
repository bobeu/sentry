Usage
-----

Interactive mode (default):
	bash scripts/buy/run_buy_flow.sh

Non-interactive mode (useful for automation / CI in WSL):
	bash scripts/buy/run_buy_flow.sh --non-interactive --network testnet --provider google --machine e2-medium --duration 1h --image ubuntu-22.04

To run a mainnet flow non-interactively you must either provide `--quote-id <id>` or run an earlier quoting step that produces `scripts/buy/out/quote.json` with a `quoteId` field. Example:

	# produce quote.json (interactive or separate run)
	bash scripts/buy/run_buy_flow.sh

	# then run non-interactive pay/status with the quoted id
	bash scripts/buy/run_buy_flow.sh --non-interactive --network mainnet --quote-id <QUOTE_ID>

Artifacts
 - `scripts/buy/out/quote.json` — raw quote output
 - `scripts/buy/out/settlement.json` — settlement details
 - `scripts/buy/out/settlement-status.log` — poll output for settlement status
 - `scripts/buy/out/ssh-run.log` — captured SSH session output (if SSH succeeds)

Notes
 - Start with `testnet` for verification and debugging.
 - On `mainnet` funding must be provided to the facilitator address (USDC/USDT) before the facilitator will accept payment; record the funding tx hash in `scripts/buy/out/funding.tx` if you want the agent to consume it later.
 - The script requires `node`, `npx`, and `jq` for best extraction of values.
Buy / cPay feedback workflow (WSL)
=================================

This folder contains a WSL-friendly script and an issue template to run the `buy` closed-beta flow, collect artifacts, and file a public issue on `celo-org/buy-skill` suitable for the Agents at Work Track 5 submission.

Prerequisites (WSL):
- Node.js and `npx` (Node 18+ recommended)
- `jq` (optional but recommended for JSON parsing)
- SSH client (openssh)
- A funded Celo wallet with USDC/USDT for mainnet runs (testnet is free)

Quick usage (testnet first):

```bash
# open WSL bash
cd /mnt/c/Users/HP/Desktop/proofOfShip/sentry
bash scripts/buy/run_buy_flow.sh
```

The script will:
- install the `@celo/buy` tool via `npx` if requested
- obtain a quote and save `scripts/buy/out/quote.json`
- prompt you to fund the facilitator address (if mainnet)
- call the pay step and save `scripts/buy/out/settlement.json`
- poll settlement status and save a log in `scripts/buy/out/settlement-status.log`
- attempt an SSH run and save `scripts/buy/out/ssh-run.log`

When finished, use `scripts/buy/issue_template.md` to compose the public issue for `celo-org/buy-skill` and paste in the artifacts and tx hashes.

Notes:
- The `buy` CLI flags and outputs may evolve. Inspect `scripts/buy/out/*.json` files and adapt the script if the CLI differs.
- The script is intentionally interactive for the funding step — do not paste private keys or secrets into the issue.
