#!/usr/bin/env bash
# Start complete Phronesis beta product: sealed executor + unified web app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

EXECUTOR_PORT="${SEALED_EXECUTOR_PORT:-8787}"
PRODUCT_PORT="${PRODUCT_PORT:-3000}"

echo "=== Phronesis Beta Product ==="
echo "Executor:  http://127.0.0.1:${EXECUTOR_PORT}"
echo "Product UI: http://localhost:${PRODUCT_PORT}"
echo "  Landing:   /"
echo "  Investor:  /investor"
echo "  Operator:  /operator"
echo ""

cleanup() {
  echo ""
  echo "Shutting down…"
  kill "$EXEC_PID" 2>/dev/null || true
  kill "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting sealed executor…"
pnpm --filter @phronesis/tokenization executor &
EXEC_PID=$!
sleep 2

echo "Starting product app…"
pnpm --filter @phronesis/product dev &
APP_PID=$!

wait "$APP_PID"
