#!/usr/bin/env bash
# Generate testnet and mainnet deployer wallets.
# Usage: bash scripts/setup/generate-wallets.sh
# Output: updates .env (testnet key) and prints mainnet address for later use.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env"

echo "Generating testnet deployer wallet..."
TESTNET_JSON=$(cast wallet new --json)
TESTNET_ADDR=$(echo "$TESTNET_JSON" | jq -r '.[0].address')
TESTNET_KEY=$(echo "$TESTNET_JSON" | jq -r '.[0].private_key')

echo "Generating mainnet deployer wallet (address only stored until you fund mainnet)..."
MAINNET_JSON=$(cast wallet new --json)
MAINNET_ADDR=$(echo "$MAINNET_JSON" | jq -r '.[0].address')
MAINNET_KEY=$(echo "$MAINNET_JSON" | jq -r '.[0].private_key')

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

# Update or append testnet vars
grep -q '^DEPLOYER_ADDRESS_TESTNET=' "$ENV_FILE" 2>/dev/null && \
  sed -i "s|^DEPLOYER_ADDRESS_TESTNET=.*|DEPLOYER_ADDRESS_TESTNET=$TESTNET_ADDR|" "$ENV_FILE" || \
  echo "DEPLOYER_ADDRESS_TESTNET=$TESTNET_ADDR" >> "$ENV_FILE"

grep -q '^DEPLOYER_PRIVATE_KEY_TESTNET=' "$ENV_FILE" 2>/dev/null && \
  sed -i "s|^DEPLOYER_PRIVATE_KEY_TESTNET=.*|DEPLOYER_PRIVATE_KEY_TESTNET=$TESTNET_KEY|" "$ENV_FILE" || \
  echo "DEPLOYER_PRIVATE_KEY_TESTNET=$TESTNET_KEY" >> "$ENV_FILE"

grep -q '^DEPLOYER_ADDRESS_MAINNET=' "$ENV_FILE" 2>/dev/null && \
  sed -i "s|^DEPLOYER_ADDRESS_MAINNET=.*|DEPLOYER_ADDRESS_MAINNET=$MAINNET_ADDR|" "$ENV_FILE" || \
  echo "DEPLOYER_ADDRESS_MAINNET=$MAINNET_ADDR" >> "$ENV_FILE"

echo ""
echo "=== Wallets generated ==="
echo "Testnet address: $TESTNET_ADDR"
echo "Mainnet address: $MAINNET_ADDR (private key printed below — store securely)"
echo ""
echo "Mainnet private key (save offline, do NOT commit):"
echo "$MAINNET_KEY"
echo ""
echo "Fund testnet at: https://faucet.0g.ai"
echo "Updated: $ENV_FILE"
