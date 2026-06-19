#!/usr/bin/env bash
# 0G Compute inference smoke test (requires funded compute account).
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
set -a && source "$ROOT/.env" && set +a

if ! command -v 0g-compute-cli >/dev/null 2>&1; then
  echo "Install: pnpm add -g @0gfoundation/0g-compute-ts-sdk"
  exit 1
fi

echo "=== 0G Compute smoke test ==="
echo "Listing inference providers (TeeML)..."
0g-compute-cli inference list-providers 2>&1 | head -40

echo ""
echo "Next manual steps (interactive CLI):"
echo "  0g-compute-cli setup-network   # select testnet"
echo "  0g-compute-cli login           # use DEPLOYER_PRIVATE_KEY_TESTNET"
echo "  0g-compute-cli deposit --amount 3   # minimum 3 0G for first ledger creation"
echo "  0g-compute-cli inference verify --provider <ADDRESS>"
