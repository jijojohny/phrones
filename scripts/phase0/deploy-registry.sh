#!/usr/bin/env bash
# Deploy MemoriaRegistry to 0G Galileo testnet and save address to .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example and configure DEPLOYER_PRIVATE_KEY_TESTNET"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DEPLOYER_PRIVATE_KEY_TESTNET:-}" ]; then
  echo "DEPLOYER_PRIVATE_KEY_TESTNET not set in .env"
  exit 1
fi

if [ ! -d lib/forge-std ]; then
  echo "Installing forge-std..."
  forge install foundry-rs/forge-std --no-commit
fi

echo "Deploying MemoriaRegistry..."
forge script script/DeployMemoriaRegistry.s.sol:DeployMemoriaRegistry \
  --rpc-url "$OG_RPC_URL" \
  --broadcast \
  --legacy \
  -vvv 2>&1 | tee /tmp/phronesis-deploy.log

# Parse deployed address from broadcast artifact or cast logs
BROADCAST=$(find broadcast -name "run-latest.json" -path "*DeployMemoriaRegistry*" 2>/dev/null | head -1)
if [ -n "$BROADCAST" ] && command -v jq >/dev/null 2>&1; then
  ADDR=$(jq -r '.transactions[] | select(.contractName=="MemoriaRegistry") | .contractAddress' "$BROADCAST" | head -1)
  if [ -n "$ADDR" ] && [ "$ADDR" != "null" ]; then
    if grep -q '^MEMORIA_REGISTRY_ADDRESS=' .env; then
      sed -i "s|^MEMORIA_REGISTRY_ADDRESS=.*|MEMORIA_REGISTRY_ADDRESS=$ADDR|" .env
    else
      echo "MEMORIA_REGISTRY_ADDRESS=$ADDR" >> .env
    fi
    echo "Saved MEMORIA_REGISTRY_ADDRESS=$ADDR to .env"
    echo "Explorer: ${OG_EXPLORER_URL:-https://chainscan-galileo.0g.ai}/address/$ADDR"
  fi
fi
