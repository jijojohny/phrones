import type { BacktestDay, MarketState } from "@phronesis/shared";
import type { BacktestFixture } from "../paper/backtest.js";

/** Generate 30-day price history from a live MarketState snapshot. */
export function generateBacktestFromSnapshot(
  snapshot: MarketState,
  days = 30,
  initialNav = 10_000,
): BacktestFixture {
  const startTs = snapshot.ts - days * 86_400_000;
  const conditionIds = snapshot.markets.map((m) => m.conditionId);
  const seedPrices: Record<string, number> = {};
  for (const m of snapshot.markets) {
    seedPrices[m.conditionId] = m.pMarket;
  }

  const daysData: BacktestDay[] = [];
  for (let d = 0; d < days; d += 1) {
    const ts = startTs + d * 86_400_000;
    const prices: Record<string, number> = {};

    for (const id of conditionIds) {
      const base = seedPrices[id] ?? 0.5;
      const prev = d === 0 ? base * 0.95 : (daysData[d - 1]?.prices[id] ?? base);
      const drift = seededNoise(id, d) * 0.02;
      const reversion = (base - prev) * 0.05;
      prices[id] = clamp(prev + drift + reversion, 0.05, 0.95);
    }

    daysData.push({ ts, prices });
  }

  return { initialNav, days: daysData };
}

function seededNoise(id: string, day: number): number {
  let h = 0;
  const key = `${id}:${day}`;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ((h % 1000) / 500) - 1;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
