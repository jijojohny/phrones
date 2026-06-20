#!/usr/bin/env bash
# TEE oracle metadata rotation E2E on testnet
set -euo pipefail

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pnpm --filter @phronesis/tokenization start -- transfer-demo
