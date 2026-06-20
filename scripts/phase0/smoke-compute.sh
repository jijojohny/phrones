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

PROVIDER="${OG_COMPUTE_PROVIDER:-}"

echo "=== 0G Compute smoke test ==="
echo "Account balance:"
0g-compute-cli get-account 2>&1 | head -25

echo ""
echo "Listing inference providers (TeeML)..."
0g-compute-cli inference list-providers 2>&1 | head -40

if [[ -n "$PROVIDER" ]]; then
  echo ""
  echo "Verifying provider $PROVIDER ..."
  0g-compute-cli inference verify --provider "$PROVIDER"

  echo ""
  echo "Generate API key (never expires):"
  echo "  0g-compute-cli inference get-secret --provider $PROVIDER --duration 0"
  echo ""
  echo "Fund provider sub-account (non-interactive):"
  echo "  0g-compute-cli transfer-fund --provider $PROVIDER --amount 1 --service inference"
else
  echo ""
  echo "Set OG_COMPUTE_PROVIDER in .env, then re-run."
  echo ""
  echo "Setup (one-time):"
  echo "  0g-compute-cli setup-network   # select testnet"
  echo "  0g-compute-cli login           # use DEPLOYER_PRIVATE_KEY_TESTNET"
  echo "  0g-compute-cli deposit --amount 3   # minimum 3 0G for first ledger creation"
  echo "  0g-compute-cli inference verify --provider <ADDRESS>"
  echo "  0g-compute-cli transfer-fund --provider <ADDRESS> --amount 1 --service inference"
fi
