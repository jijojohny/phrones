#!/usr/bin/env bash
# Phase 2 30-day paper backtest
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pnpm --filter @phronesis/tee-core backtest
