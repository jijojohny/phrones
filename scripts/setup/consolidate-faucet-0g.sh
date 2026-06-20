#!/usr/bin/env bash
# Send 0G from all funded faucet wallets → main deployer (minus gas reserve).
# Usage: bash scripts/setup/consolidate-faucet-0g.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ACCOUNTS_FILE="$ROOT/wallets/faucet/accounts.json"
DRY_RUN=false
GAS_RESERVE_WEI=5000000000000000  # 0.005 0G left for gas per wallet

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

# shellcheck disable=SC1091
if [ -f "$ROOT/.env" ]; then set -a && source "$ROOT/.env" && set +a; fi

RPC="${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}"
TO="${DEPLOYER_ADDRESS_TESTNET:-}"

if [ -z "$TO" ]; then
  echo "DEPLOYER_ADDRESS_TESTNET not set in .env"
  exit 1
fi

if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo "No faucet wallets. Run: pnpm run setup:faucet-wallets"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq required"
  exit 1
fi

echo "Consolidating 0G → $TO"
[ "$DRY_RUN" = true ] && echo "(dry run — no transactions)"

COUNT=$(jq '.accounts | length' "$ACCOUNTS_FILE")
SENT=0
SKIPPED=0

for i in $(seq 0 $((COUNT - 1))); do
  ADDR=$(jq -r ".accounts[$i].address" "$ACCOUNTS_FILE")
  KEY=$(jq -r ".accounts[$i].privateKey" "$ACCOUNTS_FILE")
  LABEL=$(jq -r ".accounts[$i].label" "$ACCOUNTS_FILE")

  BALANCE=$(cast balance "$ADDR" --rpc-url "$RPC" 2>/dev/null || echo 0)
  SEND_WEI=$((BALANCE - GAS_RESERVE_WEI))

  if [ "$SEND_WEI" -le 0 ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  SEND_OG=$(cast from-wei "$SEND_WEI" 2>/dev/null)
  echo "  $LABEL: send $SEND_OG 0G"

  if [ "$DRY_RUN" = true ]; then
    SENT=$((SENT + 1))
    continue
  fi

  for attempt in 1 2 3; do
    if cast send "$TO" --value "$SEND_WEI" --private-key "$KEY" --rpc-url "$RPC" --legacy >/dev/null 2>&1; then
      SENT=$((SENT + 1))
      sleep 2
      break
    fi
    if [ "$attempt" -eq 3 ]; then
      echo "    FAILED after 3 attempts" >&2
      exit 1
    fi
    echo "    retry $attempt..." >&2
    sleep 3
  done
done

echo ""
echo "Done. Transfers: $SENT, skipped (empty/low): $SKIPPED"
bash "$ROOT/scripts/setup/check-balance.sh"
