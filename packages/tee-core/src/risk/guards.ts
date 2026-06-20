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
