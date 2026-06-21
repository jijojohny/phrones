# Phronesis

Autonomous on-chain discretionary portfolio manager bridging Web3 prediction markets with TEE-secured AI execution on the [0G deAIOS](https://0g.ai).

## Documentation

| Document | Description |
|---|---|
| [plan.md](plan.md) | Full technical implementation plan |
| [requirement.md](requirement.md) | External APIs, credentials, and infrastructure |
| [customers.md](customers.md) | Go-to-market and investor portal guide |
| [SETUP-STEP1.md](SETUP-STEP1.md) | Step 1 setup status and next actions |

## Quick start (Step 1)

```bash
# Verify toolchain, wallets, and dependencies
pnpm run setup:verify

# Check testnet balance (fund via https://faucet.0g.ai if zero)
pnpm run setup:balance

# After funding — storage upload smoke test
pnpm run setup:storage-smoke
```

## Prerequisites

- Node.js >= 22
- pnpm >= 10
- Foundry (forge, cast)
- Git

See [SETUP-STEP1.md](SETUP-STEP1.md) for wallet addresses, MetaMask network config, and 0G Compute setup.
