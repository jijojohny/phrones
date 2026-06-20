#!/usr/bin/env bash
# Print faucet addresses for copy-paste (no private keys).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/wallets/faucet/addresses.txt"
if [ ! -f "$FILE" ]; then
  echo "Run: pnpm run setup:faucet-wallets"
  exit 1
fi
cat "$FILE"
