#!/usr/bin/env bash
set -euo pipefail

# Minimal WSL-friendly driver script for the Celo `buy` flow.
# Usage: run from WSL bash. The script guides you through quote -> fund -> pay -> run workload.

OUT_DIR="scripts/buy/out"
mkdir -p "$OUT_DIR"

check_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "Please install $1 and retry."; exit 1; }
}

check_bin jq || true
check_bin node || true

# Defaults
PROVIDER=google
MACHINE=e2-medium
DURATION=1h
IMAGE=ubuntu-22.04
NETWORK=testnet
AUTO_MODE=false
QUIET=false

usage() {
  cat <<EOF
Usage: $0 [--non-interactive] [--network testnet|mainnet] [--provider google] [--machine e2-medium] [--duration 1h] [--image ubuntu-22.04] [--quote-id <id>]

Interactive by default. Use --non-interactive to run with defaults or provided flags.
EOF
  exit 1
}

# Parse args for non-interactive runs
while [ "$#" -gt 0 ]; do
  case "$1" in
    --non-interactive) AUTO_MODE=true; shift;;
    --network) NETWORK="$2"; shift 2;;
    --provider) PROVIDER="$2"; shift 2;;
    --machine) MACHINE="$2"; shift 2;;
    --duration) DURATION="$2"; shift 2;;
    --image) IMAGE="$2"; shift 2;;
    --quote-id) QUOTE_ID="$2"; shift 2;;
    --quiet) QUIET=true; shift;;
    -h|--help) usage;;
    *) echo "Unknown arg: $1"; usage;;
  esac
done

if [ "$AUTO_MODE" = false ]; then
  echo "1) Installing / verifying @celo/buy (npx will fetch a temporary copy)..."
  echo "If you already installed globally, skip the setup step below by pressing Enter when prompted."
  read -r -p "Proceed with install/setup (y/N)? " RESP
  RESP=${RESP:-N}
  if [[ "$RESP" =~ ^[Yy] ]]; then
    echo "Running: npx --yes @celo/buy setup --name buy"
    npx --yes @celo/buy setup --name buy
    echo "Installing MCP client components..."
    npx --yes @celo/buy mcp install --client all || true
  fi
  echo
  echo "2) Prepare quote parameters"
  read -r -p "Provider (google): " PROVIDER
  PROVIDER=${PROVIDER:-google}
  read -r -p "Machine (e.g. e2-medium): " MACHINE
  MACHINE=${MACHINE:-e2-medium}
  read -r -p "Duration (eg 1h): " DURATION
  DURATION=${DURATION:-1h}
  read -r -p "Image (eg ubuntu-22.04): " IMAGE
  IMAGE=${IMAGE:-ubuntu-22.04}
  read -r -p "Network (testnet|mainnet) [testnet]: " NETWORK
  NETWORK=${NETWORK:-testnet}
fi

echo
echo "3) Requesting quote (this prints JSON). Saving to $OUT_DIR/quote.json"
set +e
if [ -n "${QUOTE_ID:-}" ]; then
  echo "Skipping quote; using provided quote id: $QUOTE_ID"
else
  npx --yes @celo/buy quote --provider "$PROVIDER" --machine "$MACHINE" --duration "$DURATION" --image "$IMAGE" --network "$NETWORK" > "$OUT_DIR/quote.json" 2>&1
  QRC=$?
  if [ $QRC -ne 0 ]; then
    echo "Quote command failed. Inspect $OUT_DIR/quote.json for output.";
    set -e
    exit 1
  fi
fi
set -e

echo "Quote saved. Parsing facilitator address and amount (best-effort using jq)."
if command -v jq >/dev/null 2>&1; then
  if [ -n "${QUOTE_ID:-}" ]; then
    FACILITATOR="(quote id provided; check output after pay)"
    AMOUNT="(quote id provided)"
  else
    FACILITATOR=$(jq -r '.facilitatorAddress // .depositAddress // .facilitator.address // empty' "$OUT_DIR/quote.json" || true)
    AMOUNT=$(jq -r '.amount // .price // .quoteAmount // empty' "$OUT_DIR/quote.json" || true)
  fi
else
  FACILITATOR="(install jq to extract values automatically)"
  AMOUNT="(see $OUT_DIR/quote.json)"
fi

echo
echo "Quote details:" 
echo "  facilitator: ${FACILITATOR:-(not-found)}"
echo "  amount: ${AMOUNT:-(not-found)}"
echo
echo "4) FUNDING: Send the quoted USDC/USDT amount to the facilitator address on Celo mainnet (only if you chose mainnet)."
echo "   DO NOT SHARE PRIVATE KEYS. Capture the funding tx hash."
if [ "$NETWORK" = "mainnet" ]; then
  if [ "$AUTO_MODE" = false ]; then
    read -r -p "Type the funding tx hash after you send funds (or press Enter to skip/continue): " FUND_TX
    FUND_TX=${FUND_TX:-}
  else
    FUND_TX=""
  fi
  if [ -n "$FUND_TX" ]; then
    echo "Saved funding tx: $FUND_TX" > "$OUT_DIR/funding.tx"
  fi
fi

echo
echo "5) Approve / Pay using the buy CLI"
echo "This will ask for the quote/settlement id. We'll attempt to call the pay command and save settlement output."
if [ -z "${SETTLE_ID:-}" ]; then
  if command -v jq >/dev/null 2>&1 && [ -f "$OUT_DIR/quote.json" ]; then
    SETTLE_ID=$(jq -r '.quoteId // .id // .settlementId // empty' "$OUT_DIR/quote.json" || true)
  fi
fi
if [ -z "${SETTLE_ID:-}" ]; then
  if [ "$AUTO_MODE" = true ]; then
    echo "Non-interactive mode requires --quote-id or a quote that exposes quoteId. Exiting.";
    exit 1
  fi
  read -r -p "Enter quoteId or settlementId (or leave blank to attempt to extract from quote.json): " SETTLE_ID
fi
if [ -z "$SETTLE_ID" ]; then
  echo "No settlement id found; please inspect $OUT_DIR/quote.json and re-run with an id.";
  exit 1
fi

echo "Running pay... (output -> $OUT_DIR/settlement.json)"
set +e
npx --yes @celo/buy pay --settlement "$SETTLE_ID" --network "$NETWORK" > "$OUT_DIR/settlement.json" 2>&1
PAYRC=$?
set -e
if [ $PAYRC -ne 0 ]; then
  echo "Pay command returned non-zero. Inspect $OUT_DIR/settlement.json for details.";
fi

echo "6) Poll settlement status until ready (or timeout). Output appended to $OUT_DIR/settlement-status.log"
for i in {1..30}; do
  echo "Polling ($i/30)..."
  npx --yes @celo/buy status --settlement "$SETTLE_ID" --network "$NETWORK" >> "$OUT_DIR/settlement-status.log" 2>&1 || true
  sleep 5
  if command -v jq >/dev/null 2>&1; then
    READY=$(jq -r '.status // .state // empty' "$OUT_DIR/settlement-status.log" | tail -n1 || true)
    echo "Latest state: $READY"
    if [[ "$READY" =~ (ready|confirmed|running|allocated) ]]; then
      break
    fi
  fi
done

echo "7) If VM details were returned, try connecting and run a short workload."
VM_HOST=$(jq -r '.vmHost // .host // .connection.host // empty' "$OUT_DIR/settlement.json" 2>/dev/null || true)
SSH_USER=$(jq -r '.vmUser // .connection.user // "ubuntu"' "$OUT_DIR/settlement.json" 2>/dev/null || true)
if [ -n "$VM_HOST" ] && [ "$VM_HOST" != "null" ]; then
  echo "Attempting SSH: $SSH_USER@$VM_HOST"
  echo "Running a simple CPU benchmark and saving to $OUT_DIR/ssh-run.log"
  ssh -o StrictHostKeyChecking=no "$SSH_USER@$VM_HOST" 'bash -lc "date --utc +%FT%TZ; uname -a; python3 -c \"import time; t0=time.time(); [sum(i*i for i in range(2000000)) for _ in range(3)]; print(time.time()-t0)\""' > "$OUT_DIR/ssh-run.log" 2>&1 || true
  echo "SSH run saved to $OUT_DIR/ssh-run.log"
else
  echo "No VM host found in settlement output. Inspect $OUT_DIR/settlement.json and settlement-status logs."
fi

echo
echo "Artifacts saved under $OUT_DIR: quote.json, settlement.json, settlement-status.log, ssh-run.log"
echo "Next: gather those artifacts and use the issue template in scripts/buy/issue_template.md to file on celo-org/buy-skill."

exit 0
