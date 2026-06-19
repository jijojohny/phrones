#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
set -a && source "$ROOT/.env" && set +a
RPC="${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}"
echo "Testnet deployer: ${DEPLOYER_ADDRESS_TESTNET:-not set}"
cast balance "${DEPLOYER_ADDRESS_TESTNET}" --rpc-url "$RPC" | xargs -I{} cast from-wei {} 2>/dev/null | xargs -I{} echo "Balance: {} 0G"
