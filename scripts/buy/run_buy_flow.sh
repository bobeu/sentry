#!/usr/bin/env bash
set -euo pipefail

# Driver script for Celo `buy` flow (Track 5: Best Feedback for buy)
# Configured for account: agentatwork (0x645ea27b7B81dc0E43bD58e75606D1eB0c646a8B)

OUT_DIR="scripts/buy/out"
mkdir -p "$OUT_DIR"

ACCOUNT_NAME="agentatwork"
ACCOUNT_ADDRESS="0x645ea27b7B81dc0E43bD58e75606D1eB0c646a8B"
TOKEN="USDT"
MAX_AMOUNT="0.1"
MACHINE_TYPE="e2-medium"
ENDPOINT_URL="https://usebuy.ai/google/vm"
SCRIPT_WORKLOAD="uname -a; nproc; uptime"

if command -v buy >/dev/null 2>&1; then
  BUY_CMD="buy"
else
  BUY_CMD="npx --yes @celo/buy@0.6.0"
fi

echo "============================================================"
echo " Celo Buy Beta Test Runner (@celo/buy@0.6.0)"
echo " Account Name: $ACCOUNT_NAME"
echo " Wallet Address: $ACCOUNT_ADDRESS"
echo " Endpoint: $ENDPOINT_URL"
echo " Token: $TOKEN | Max Amount: $MAX_AMOUNT | Machine: $MACHINE_TYPE"
echo "============================================================"

AUTO_MODE=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --non-interactive) AUTO_MODE=true; shift;;
    --token) TOKEN="$2"; shift 2;;
    --max-amount) MAX_AMOUNT="$2"; shift 2;;
    --machine) MACHINE_TYPE="$2"; shift 2;;
    -h|--help) exit 0;;
    *) shift;;
  esac
done

if [ "$AUTO_MODE" = false ]; then
  echo
  read -r -p "Proceed with VM rental request on $ENDPOINT_URL (Y/n)? " RESP
  RESP=${RESP:-Y}
  if [[ ! "$RESP" =~ ^[Yy] ]]; then
    echo "Cancelled by user."
    exit 0
  fi
fi

TIMING_LOG="$OUT_DIR/timing.log"
echo "--- Run started at $(date -u +%Y-%m-%dT%H:%M:%SZ) ---" > "$TIMING_LOG"

echo
echo "1) Executing paid 402 HTTP request via buy fetch..."
RESPONSE_FILE="$OUT_DIR/buy-response.json"
PAYLOAD_JSON="{\"script\":\"$SCRIPT_WORKLOAD\",\"machineType\":\"$MACHINE_TYPE\"}"

T_START=$(date +%s)
$BUY_CMD --account "$ACCOUNT_NAME" fetch -X POST -H "Content-Type: application/json" --token "$TOKEN" --max-amount "$MAX_AMOUNT" -d "$PAYLOAD_JSON" "$ENDPOINT_URL" > "$RESPONSE_FILE" 2>&1 || true
T_END=$(date +%s)
LATENCY=$((T_END - T_START))
echo "Rental 402 Payment & VM Request Latency: ${LATENCY}s" >> "$TIMING_LOG"

echo "✅ Rental request finished in ${LATENCY}s (saved to $RESPONSE_FILE)."
echo
echo "Response Output:"
cat "$RESPONSE_FILE"
echo

# Parse Poll URL
POLL_URL=$(jq -r '.poll // .pollUrl // .statusUrl // empty' "$RESPONSE_FILE" 2>/dev/null || true)

if [ -n "$POLL_URL" ] && [ "$POLL_URL" != "null" ]; then
  echo
  echo "2) Polling VM workload status at $POLL_URL..."
  POLL_LOG="$OUT_DIR/poll-status.log"
  for i in {1..30}; do
    echo "Polling attempt $i/30..."
    $BUY_CMD --account "$ACCOUNT_NAME" fetch "$POLL_URL" >> "$POLL_LOG" 2>&1 || true
    sleep 5
    if grep -q -i "done" "$POLL_LOG" 2>/dev/null; then
      echo "✅ Workload execution completed!"
      break
    fi
  done
else
  echo "ℹ️ No Poll URL extracted directly. Inspect $RESPONSE_FILE."
fi

echo
echo "============================================================"
echo " Execution Complete! All artifacts saved under $OUT_DIR:"
echo " - buy-response.json"
echo " - poll-status.log"
echo " - timing.log"
echo "============================================================"
