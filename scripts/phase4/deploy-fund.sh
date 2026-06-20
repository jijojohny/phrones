#!/usr/bin/env bash
# Deploy PhronesisFund + PhronesisOracle to 0G Galileo testnet
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example and configure DEPLOYER_PRIVATE_KEY_TESTNET"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DEPLOYER_PRIVATE_KEY_TESTNET:-}" ]; then
  echo "DEPLOYER_PRIVATE_KEY_TESTNET not set in .env"
  exit 1
fi

if [ ! -d lib/forge-std ]; then
  forge install foundry-rs/forge-std --no-commit
fi

echo "Deploying PhronesisFund + Oracle..."
forge script script/DeployPhronesisFund.s.sol:DeployPhronesisFund \
  --rpc-url "$OG_RPC_URL" \
  --broadcast \
  --legacy \
  -vvv 2>&1 | tee /tmp/phronesis-fund-deploy.log

BROADCAST=$(find broadcast -name "run-latest.json" -path "*DeployPhronesisFund*" 2>/dev/null | head -1)
if [ -n "$BROADCAST" ] && command -v jq >/dev/null 2>&1; then
  FUND=$(jq -r '.transactions[] | select(.contractName=="PhronesisFund") | .contractAddress' "$BROADCAST" | head -1)
  ORACLE=$(jq -r '.transactions[] | select(.contractName=="PhronesisOracle") | .contractAddress' "$BROADCAST" | head -1)
  SHARE=$(cast call "$FUND" "shareToken()(address)" --rpc-url "$OG_RPC_URL" 2>/dev/null || true)

  for kv in "PHRONESIS_FUND_ADDRESS=$FUND" "PHRONESIS_ORACLE_ADDRESS=$ORACLE" "PHRONESIS_SHARE_ADDRESS=$SHARE"; do
    KEY="${kv%%=*}"
    VAL="${kv#*=}"
    if [ -n "$VAL" ] && [ "$VAL" != "null" ]; then
      if grep -q "^${KEY}=" .env; then
        sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" .env
      else
        echo "${KEY}=${VAL}" >> .env
      fi
      echo "Saved ${KEY}=${VAL}"
    fi
  done
fi
