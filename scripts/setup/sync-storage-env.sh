#!/usr/bin/env bash
# Sync testnet private key from root .env to storage starter kit .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KIT="$ROOT/tools/0g-storage-ts-starter-kit"

# shellcheck disable=SC1091
set -a && source "$ROOT/.env" && set +a

if [ -z "${DEPLOYER_PRIVATE_KEY_TESTNET:-}" ]; then
  echo "DEPLOYER_PRIVATE_KEY_TESTNET not set in $ROOT/.env"
  exit 1
fi

cat > "$KIT/.env" <<EOF
NETWORK=testnet
STORAGE_MODE=turbo
PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY_TESTNET}
EOF

echo "Synced storage starter kit .env (testnet key from root .env)"
