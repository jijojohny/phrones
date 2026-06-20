#!/usr/bin/env bash
# Check 0G balances for all faucet wallets + main deployer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ACCOUNTS_FILE="$ROOT/wallets/faucet/accounts.json"
RPC="${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}"

# shellcheck disable=SC1091
if [ -f "$ROOT/.env" ]; then set -a && source "$ROOT/.env" && set +a; fi
RPC="${OG_RPC_URL:-$RPC}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq required"
  exit 1
fi

if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo "No faucet wallets found. Run: pnpm run setup:faucet-wallets"
  exit 1
fi

echo "=== Faucet wallet balances (0G Galileo) ==="
TOTAL_WEI=0
COUNT=$(jq '.accounts | length' "$ACCOUNTS_FILE")

for i in $(seq 0 $((COUNT - 1))); do
  ADDR=$(jq -r ".accounts[$i].address" "$ACCOUNTS_FILE")
  LABEL=$(jq -r ".accounts[$i].label" "$ACCOUNTS_FILE")
  WEI=$(cast balance "$ADDR" --rpc-url "$RPC" 2>/dev/null || echo 0)
  ETH=$(cast from-wei "$WEI" 2>/dev/null || echo 0)
  TOTAL_WEI=$((TOTAL_WEI + WEI))
  if [ "$WEI" != "0" ]; then
    printf "  %s  %s  %s 0G\n" "$LABEL" "$ADDR" "$ETH"
  fi
done

TOTAL_OG=$(cast from-wei "$TOTAL_WEI" 2>/dev/null || echo 0)
FUNDED=$(jq -r '[.accounts[] | .address] | length' "$ACCOUNTS_FILE")
echo ""
echo "Faucet wallets total: $TOTAL_OG 0G across accounts with balance"

if [ -n "${DEPLOYER_ADDRESS_TESTNET:-}" ]; then
  DEP_WEI=$(cast balance "$DEPLOYER_ADDRESS_TESTNET" --rpc-url "$RPC" 2>/dev/null || echo 0)
  DEP_OG=$(cast from-wei "$DEP_WEI" 2>/dev/null || echo 0)
  echo "Main deployer ($DEPLOYER_ADDRESS_TESTNET): $DEP_OG 0G"
fi

echo ""
echo "Need ≥ 3.0 0G on deployer for: 0g-compute-cli deposit --amount 3"
