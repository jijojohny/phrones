#!/usr/bin/env bash
# Phase 2 cognitive cycle (paper mode, fixture snapshot)
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EXTRA=()
if [[ "${1:-}" == "--llm" ]]; then
  EXTRA+=(--llm)
fi
if [[ "${1:-}" == "--anchor" ]] || [[ "${2:-}" == "--anchor" ]]; then
  EXTRA+=(--anchor)
fi

pnpm --filter @phronesis/tee-core start -- --fixture --paper "${EXTRA[@]}"
