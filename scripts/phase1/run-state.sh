#!/usr/bin/env bash
# Phase 1 live market state + divergence dashboard
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DURATION="${1:-120}"
MARKETS="${2:-50}"

pnpm --filter @phronesis/ingestion phase1 -- --duration="$DURATION" --markets="$MARKETS"
