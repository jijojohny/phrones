#!/usr/bin/env bash
# Run 0G Storage upload smoke test (requires funded testnet wallet).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KIT="$ROOT/tools/0g-storage-ts-starter-kit"

bash "$ROOT/scripts/setup/sync-storage-env.sh"

# Create test payload
TEST_FILE="$ROOT/tools/test-payload/phronesis-step1.txt"
mkdir -p "$(dirname "$TEST_FILE")"
echo "Phronesis Step 1 storage smoke test — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$TEST_FILE"

cd "$KIT"
echo "Uploading test file to 0G Storage..."
npm run upload -- "$TEST_FILE"
