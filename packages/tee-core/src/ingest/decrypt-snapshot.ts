import type { EncryptedMarketStateBundle, MarketState } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { decryptJson } from "../crypto/aes-gcm.js";

const MARKET_STATE_SALT = "phronesis-market-state-v1";

export function getMarketStateSecret(): string {
  const key = env.marketStateEncryptionKey || env.fundEncryptionKey || "";
  if (!key) {
    throw new Error("MARKET_STATE_ENCRYPTION_KEY or FUND_ENCRYPTION_KEY required");
  }
  return key;
}

export function decryptMarketSnapshot(
  bundle: EncryptedMarketStateBundle,
  secret = getMarketStateSecret(),
): MarketState {
  return decryptJson<MarketState>(bundle, secret, MARKET_STATE_SALT);
}

export function validateSnapshotFreshness(
  snapshot: MarketState,
  maxStaleMs = env.maxSnapshotStaleMs,
): void {
  const age = Date.now() - snapshot.ts;
  if (age > maxStaleMs) {
    throw new Error(`snapshot stale: ${Math.round(age / 1000)}s > ${maxStaleMs / 1000}s limit`);
  }
}

export function normalizeSnapshot(
  raw: MarketState,
  strictFreshness = false,
): MarketState {
  if (strictFreshness) {
    validateSnapshotFreshness(raw);
  } else if (Date.now() - raw.ts > env.maxSnapshotStaleMs) {
    raw = {
      ...raw,
      ts: Date.now(),
      markets: raw.markets.map((m) => ({ ...m, updatedAt: Date.now() })),
    };
  }

  return {
    ...raw,
    markets: raw.markets.map((m) => ({
      ...m,
      pMarket: clamp(m.pMarket, 0.01, 0.99),
      pSentiment: clamp(m.pSentiment, 0.01, 0.99),
    })),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
