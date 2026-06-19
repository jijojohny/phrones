#!/usr/bin/env bash
# Verify Step 1 toolchain requirements for Phronesis Phase 0.
# Usage: bash scripts/setup/verify-step1.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ERR=1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

ERR=0

echo "=== Phronesis Step 1 — Toolchain Verification ==="
echo ""

# Node >= 22
if command -v node >/dev/null 2>&1; then
  NODE_V=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_V" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "Node.js $NODE_V (>= 22 required)"
  else
    fail "Node.js $NODE_V — need >= 22"
  fi
else
  fail "Node.js not installed"
fi

# pnpm
if command -v pnpm >/dev/null 2>&1; then
  pass "pnpm $(pnpm --version)"
else
  fail "pnpm not installed — run: npm install -g pnpm"
fi

# Git
if command -v git >/dev/null 2>&1; then
  pass "git $(git --version | awk '{print $3}')"
else
  fail "git not installed"
fi

# Foundry
if command -v forge >/dev/null 2>&1; then
  pass "Foundry $(forge --version | head -1)"
else
  fail "Foundry not installed — curl -L https://foundry.paradigm.xyz | bash && foundryup"
fi

if command -v cast >/dev/null 2>&1; then
  pass "cast available"
else
  fail "cast not found (install Foundry)"
fi

# 0G Compute CLI
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"
if command -v 0g-compute-cli >/dev/null 2>&1; then
  pass "0g-compute-cli $(0g-compute-cli --version 2>/dev/null || echo 'installed')"
else
  fail "0g-compute-cli not in PATH — run: pnpm setup && pnpm add -g @0gfoundation/0g-compute-ts-sdk"
fi

# Storage starter kit
if [ -d "$ROOT/tools/0g-storage-ts-starter-kit" ]; then
  pass "0G Storage starter kit cloned"
  if [ -d "$ROOT/tools/0g-storage-ts-starter-kit/node_modules" ]; then
    pass "Storage starter kit dependencies installed"
  else
    warn "Storage starter kit deps missing — run: cd tools/0g-storage-ts-starter-kit && npm install"
  fi
else
  fail "Storage starter kit not cloned — run: git clone https://github.com/0gfoundation/0g-storage-ts-starter-kit.git tools/0g-storage-ts-starter-kit"
fi

# .env
if [ -f "$ROOT/.env" ]; then
  pass ".env exists"
  # shellcheck disable=SC1091
  set -a && source "$ROOT/.env" && set +a
  if [ -n "${DEPLOYER_ADDRESS_TESTNET:-}" ]; then
    pass "Testnet deployer address configured: $DEPLOYER_ADDRESS_TESTNET"
  else
    fail "DEPLOYER_ADDRESS_TESTNET not set in .env"
  fi
else
  fail ".env missing — copy .env.example to .env and generate wallets"
fi

# Testnet balance
if [ -n "${DEPLOYER_ADDRESS_TESTNET:-}" ] && command -v cast >/dev/null 2>&1; then
  RPC="${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}"
  BALANCE=$(cast balance "$DEPLOYER_ADDRESS_TESTNET" --rpc-url "$RPC" 2>/dev/null || echo "0")
  BALANCE_ETH=$(cast from-wei "$BALANCE" 2>/dev/null || echo "0")
  if [ "$BALANCE" != "0" ] && [ -n "$BALANCE" ]; then
    pass "Testnet wallet funded: $BALANCE_ETH 0G"
  else
    warn "Testnet wallet not funded yet — visit https://faucet.0g.ai with address $DEPLOYER_ADDRESS_TESTNET"
  fi
fi

echo ""
if [ "${ERR:-0}" -eq 0 ]; then
  echo -e "${GREEN}All required toolchain checks passed.${NC}"
else
  echo -e "${RED}Some checks failed. Fix items above before continuing.${NC}"
  exit 1
fi
