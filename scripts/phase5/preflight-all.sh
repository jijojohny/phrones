#!/usr/bin/env bash
# Phase 5 production preflight + load test + compliance memo
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Forge tests ==="
forge test

echo ""
echo "=== Build ==="
pnpm build

echo ""
echo "=== Preflight ==="
pnpm phase5:preflight

echo ""
echo "=== Cognitive load test ==="
pnpm phase5:load-test

echo ""
echo "=== Compliance memo ==="
pnpm phase5:compliance
