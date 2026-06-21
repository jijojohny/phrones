import type { MarketEntry, StrategyConfig } from "@phronesis/shared";

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

export function checkMarketGuards(
  market: MarketEntry,
  strategy: StrategyConfig,
  now = Date.now(),
): GuardResult {
  if (strategy.bannedMarkets.includes(market.conditionId)) {
    return { ok: false, reason: "banned market" };
  }

  if (market.volume24hr < strategy.minLiquidityUsd) {
    return { ok: false, reason: "low liquidity" };
  }

  if (Math.abs(market.divergence) < strategy.divergenceThreshold) {
    return { ok: false, reason: "below divergence threshold" };
  }

  if (market.expiry) {
    const hoursLeft = (market.expiry - now) / 3_600_000;
    if (hoursLeft < strategy.minHoursToExpiry) {
      return { ok: false, reason: "near expiry" };
    }
  }

  const staleMs = now - market.updatedAt;
  if (staleMs > 120_000) {
    return { ok: false, reason: "stale market data" };
  }

  return { ok: true };
}

export function checkDrawdownGuard(
  peakNav: number,
  currentNav: number,
  maxDrawdownPct: number,
): GuardResult {
  if (peakNav <= 0) return { ok: true };
  const dd = (peakNav - currentNav) / peakNav;
  if (dd >= maxDrawdownPct) {
    return { ok: false, reason: `max drawdown ${(dd * 100).toFixed(1)}%` };
  }
  return { ok: true };
}

export function checkCorrelationGuard(
  market: MarketEntry,
  book: MarketEntry[],
  maxCorrelation: number,
): GuardResult {
  for (const existing of book) {
    if (existing.conditionId === market.conditionId) continue;
    const rho = tagCorrelation(market, existing);
    if (rho >= maxCorrelation) {
      return {
        ok: false,
        reason: `correlation ${rho.toFixed(2)} with ${existing.slug}`,
      };
    }
  }
  return { ok: true };
}

export function checkCircuitBreaker(
  snapshotTs: number,
  attestationOk: boolean,
  maxStaleMs: number,
): GuardResult {
  const staleMs = Date.now() - snapshotTs;
  if (staleMs > maxStaleMs) {
    return { ok: false, reason: `feed stale ${Math.round(staleMs / 1000)}s` };
  }
  if (!attestationOk) {
    return { ok: false, reason: "attestation invalid or expired" };
  }
  return { ok: true };
}

function tagCorrelation(a: MarketEntry, b: MarketEntry): number {
  const tagsA = new Set(a.tags.map((t) => t.toLowerCase()));
  const tagsB = new Set(b.tags.map((t) => t.toLowerCase()));
  if (tagsA.size === 0 || tagsB.size === 0) {
    return questionOverlap(a.question, b.question);
  }

  let overlap = 0;
  for (const t of tagsA) {
    if (tagsB.has(t)) overlap += 1;
  }
  return overlap / Math.max(tagsA.size, tagsB.size);
}

function questionOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap += 1;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}
