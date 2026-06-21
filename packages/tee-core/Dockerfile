FROM node:22-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/audit/package.json packages/audit/
COPY packages/tee-core/package.json packages/tee-core/
COPY packages/x402-client/package.json packages/x402-client/

RUN pnpm install --filter @phronesis/tee-core... --frozen-lockfile || pnpm install --filter @phronesis/tee-core...

COPY packages/shared packages/shared
COPY packages/audit packages/audit
COPY packages/tee-core packages/tee-core
COPY packages/x402-client packages/x402-client

RUN pnpm --filter @phronesis/shared build && pnpm --filter @phronesis/tee-core build

ENV NODE_ENV=production
EXPOSE 9091

# Dstack/Cryptopilot-compatible TEE cognitive service entrypoint
CMD ["node", "packages/tee-core/dist/cli.js", "--fixture", "--attestation-server"]
