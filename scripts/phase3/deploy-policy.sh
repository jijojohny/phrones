#!/usr/bin/env bash
# Deploy ExecutionPolicy to Polygon (or fork) and whitelist Polymarket contracts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RPC="${POLYGON_RPC_URL:-https://polygon-rpc.com}"
DEPLOYER="${DEPLOYER_ADDRESS_TESTNET:-}"

echo "Deploying ExecutionPolicy to Polygon..."
echo "RPC: $RPC"

forge script script/DeployExecutionPolicy.s.sol:DeployExecutionPolicy \
  --rpc-url "$RPC" \
  --broadcast \
  --legacy \
  -vvv 2>&1 || {
  echo ""
  echo "Dry-run deploy (no broadcast) — set DEPLOYER_PRIVATE_KEY for live deploy"
  forge script script/DeployExecutionPolicy.s.sol:DeployExecutionPolicy --rpc-url "$RPC" -vvv
}

echo ""
echo "Add to .env: EXECUTION_POLICY_ADDRESS=<deployed>"
