#!/usr/bin/env bash
# Demo: authorize test investor + start sealed executor + portal
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

INVESTOR="${1:-}"

if [ -z "$INVESTOR" ]; then
  echo "Usage: $0 <investor-address>"
  exit 1
fi

pnpm phase4:authorize -- --investor="$INVESTOR"
echo ""
echo "Start services in separate terminals:"
echo "  pnpm phase4:executor"
echo "  pnpm phase4:portal"
echo "Then open http://localhost:3000 and enter $INVESTOR"
