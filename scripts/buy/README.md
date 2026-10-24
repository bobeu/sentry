# Sentry Track 5 (`buy` / prev. cPay Feedback) Execution Kit

This folder contains scripts and templates for completing **Track 5: Best Feedback for buy ($250 in CELO)** for Sentry.

---

## Pre-Requisites & Current Setup

- **Installed CLI:** `@celo/buy@0.6.0` (`npm install -g @celo/buy@0.6.0`)
- **Active Account:** `agentatwork`
- **Wallet Address:** `0x645ea27b7B81dc0E43bD58e75606D1eB0c646a8B` (Celo Mainnet)

---

## How to Run

You can run the driver script in **Windows PowerShell** or **WSL (Bash)**.

### Option A: Windows PowerShell (Native)

```powershell
# Open PowerShell in repo root (c:\Users\HP\Desktop\proofOfShip\sentry)
.\scripts\buy\run_buy_flow.ps1
```

Or for non-interactive mode:
```powershell
.\scripts\buy\run_buy_flow.ps1 -NonInteractive -Network mainnet -Machine e2-medium -Duration 1h
```

### Option B: WSL (Linux Bash)

```bash
# Open WSL bash in repo root (/mnt/c/Users/HP/Desktop/proofOfShip/sentry)
bash scripts/buy/run_buy_flow.sh
```

Or for non-interactive mode:
```bash
bash scripts/buy/run_buy_flow.sh --non-interactive --network mainnet --machine e2-medium --duration 1h
```

---

## What the Script Does

1. **Quote:** Requests a quote for GCP compute (`e2-medium`, `ubuntu-22.04`, `1h`) using `@celo/buy`. Saves to `scripts/buy/out/quote.json`.
2. **Funding Check:** Prompts for your funding transaction hash on Celo Mainnet (`0x645ea27b7B81dc0E43bD58e75606D1eB0c646a8B`).
3. **Pay:** Executes settlement using `buy pay --settlement <QUOTE_ID>`. Saves to `scripts/buy/out/settlement.json`.
4. **Poll:** Monitors allocation status with `buy status` and saves logs to `scripts/buy/out/settlement-status.log`.
5. **Workload:** Connects via SSH to the VM host and executes a deterministic CPU benchmark, saving to `scripts/buy/out/ssh-run.log`.
6. **Timing Metrics:** Records latencies for all steps in `scripts/buy/out/timing.log`.

---

## Filing the Public Issue on GitHub (Track 5 Requirement)

1. Open `scripts/buy/issue_template.md`.
2. Fill in the placeholders (`<INSERT_FUNDING_TX_HASH>`, quote JSON, settlement JSON, timing numbers, observed friction points).
3. Post the completed markdown as a **Public Issue** on:
   `https://github.com/celo-org/buy-skill/issues/new`
4. Copy the URL of the created public GitHub issue (e.g. `https://github.com/celo-org/buy-skill/issues/42`).
5. Paste this issue URL into your Celo Builders submission for Sentry on `https://celobuilders.xyz`.
