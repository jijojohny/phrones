#!/usr/bin/env bash
# Phase 3: cognitive cycle → policy check → dry-run execution
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="--dry-run"
if [[ "${1:-}" == "--live" ]]; then
  MODE="--live"
fi

pnpm --filter @phronesis/execution start -- "$MODE" "${@:2}"
