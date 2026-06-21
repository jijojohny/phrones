import type { MarketState, StrategyConfig } from "@phronesis/shared";
import { env } from "@phronesis/shared";

/** Trigger when top divergence exceeds threshold or gross opportunity set is large. */
export function shouldRebalance(snapshot: MarketState, _strategy: StrategyConfig): boolean {
  const topDiv = snapshot.markets[0]?.divergence ?? 0;
  if (Math.abs(topDiv) >= env.divergenceThreshold) return true;

  const highEdge = snapshot.markets.filter(
    (m) => Math.abs(m.divergence) >= env.rebalanceThreshold,
  ).length;
  return highEdge >= 3;
}
