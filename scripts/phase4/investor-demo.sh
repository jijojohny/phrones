#!/usr/bin/env bash
# Phase 4 E2E: authorize → deposit → performance → audit verify
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

set -a
# shellcheck disable=SC1091
source .env
set +a

INVESTOR="${1:-${DEPLOYER_ADDRESS_TESTNET:-}}"
if [ -z "$INVESTOR" ]; then
  echo "Usage: $0 [investor_address]"
  exit 1
fi

echo "=== Phase 4 investor demo ==="
echo "Investor: $INVESTOR"
echo ""

echo "1/5 Authorize investor..."
pnpm --filter @phronesis/tokenization start -- authorize --investor="$INVESTOR"

echo ""
echo "2/5 Deposit 0.01 OG..."
pnpm --filter @phronesis/tokenization start -- deposit --amount=0.01

echo ""
echo "3/5 Check authorization + shares..."
pnpm --filter @phronesis/tokenization start -- check --investor="$INVESTOR"

echo ""
echo "4/5 Latest audit root..."
pnpm --filter @phronesis/tokenization start -- audit || true

echo ""
echo "5/5 Start sealed executor and query performance (background 8787)..."
echo "   pnpm phase4:executor"
echo "   curl \"http://localhost:8787/performance?investor=$INVESTOR\""
echo ""
echo "Done — investor can use apps/investor-portal or static portal"
