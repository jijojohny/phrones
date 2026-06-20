#!/usr/bin/env bash
# Generate multiple testnet wallets for faucet requests (0.1 0G/day each).
# Usage: bash scripts/setup/generate-faucet-wallets.sh [count]
# Output: wallets/faucet/accounts.json + addresses.txt (gitignored)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COUNT="${1:-35}"
OUT_DIR="$ROOT/wallets/faucet"
ACCOUNTS_FILE="$OUT_DIR/accounts.json"
ADDRESSES_FILE="$OUT_DIR/addresses.txt"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install: sudo apt install jq"
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "cast (Foundry) is required."
  exit 1
fi

if [ "$COUNT" -lt 1 ] || [ "$COUNT" -gt 100 ]; then
  echo "Count must be between 1 and 100 (got: $COUNT)"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Generating $COUNT faucet wallets..."

ACCOUNTS_JSON="[]"
ADDRESSES=""

for i in $(seq 1 "$COUNT"); do
  WALLET_JSON=$(cast wallet new --json)
  ADDR=$(echo "$WALLET_JSON" | jq -r '.[0].address')
  KEY=$(echo "$WALLET_JSON" | jq -r '.[0].private_key')
  LABEL=$(printf "faucet-%02d" "$i")

  ENTRY=$(jq -n \
    --arg index "$i" \
    --arg address "$ADDR" \
    --arg privateKey "$KEY" \
    --arg label "$LABEL" \
    '{index: ($index|tonumber), address: $address, privateKey: $privateKey, label: $label}')

  ACCOUNTS_JSON=$(echo "$ACCOUNTS_JSON" | jq --argjson entry "$ENTRY" '. + [$entry]')
  ADDRESSES+="$ADDR"$'\n'

  printf "  [%s] %s\n" "$LABEL" "$ADDR"
done

CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -n \
  --arg network "0G Galileo Testnet" \
  --argjson chainId 16602 \
  --arg createdAt "$CREATED_AT" \
  --argjson count "$COUNT" \
  --argjson accounts "$ACCOUNTS_JSON" \
  '{
    network: $network,
    chainId: $chainId,
    createdAt: $createdAt,
    count: $count,
    faucetUrl: "https://faucet.0g.ai",
    faucetDailyLimit: "0.1 0G per wallet per day",
    accounts: $accounts
  }' > "$ACCOUNTS_FILE"

printf "%s" "$ADDRESSES" > "$ADDRESSES_FILE"

echo ""
echo "=== Saved (gitignored) ==="
echo "  $ACCOUNTS_FILE"
echo "  $ADDRESSES_FILE"
echo ""
echo "=== Faucet workflow ==="
echo "1. Request 0.1 0G for each address at https://faucet.0g.ai"
echo "   Tip: copy from $ADDRESSES_FILE (one address per line)"
echo "2. Check balances:  pnpm run setup:faucet-balances"
echo "3. After funding, consolidate to deployer:  pnpm run setup:faucet-consolidate"
echo ""
echo "Target: ~3.0 0G on deployer for first 0g-compute-cli deposit (minimum 3 0G)"
echo "With 0.1 0G/day per wallet, $COUNT wallets ≈ $(awk "BEGIN {printf \"%.1f\", $COUNT * 0.1}") 0G if all funded once."
