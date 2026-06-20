#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

source .env 2>/dev/null || true

forge script script/DeployIntentBridge.s.sol:DeployIntentBridge \
  --rpc-url "${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}" \
  --broadcast \
  --legacy

echo "Add INTENT_BRIDGE_ADDRESS to .env from broadcast output"
