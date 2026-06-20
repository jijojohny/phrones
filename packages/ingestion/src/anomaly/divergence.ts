import type { DivergenceAlert, DivergenceConfig, MarketEntry } from "@phronesis/shared";

export function sentimentImpliedP(
  pMarket: number,
  score: number,
  confidence: number,
  alpha: number,
): number {
  const shift = alpha * score * confidence;
  return clamp(pMarket + shift, 0.01, 0.99);
}

export function computeDivergence(pMarket: number, pSentiment: number): number {
  return pSentiment - pMarket;
}

export function scoreMarket(entry: MarketEntry, config: DivergenceConfig): DivergenceAlert {
  const absDivergence = Math.abs(entry.divergence);
  const now = Date.now();
  const timeToExpirySec = entry.expiry ? (entry.expiry - now) / 1000 : Infinity;

  let tradeable = absDivergence >= config.threshold;
  let reason: string | undefined;

  if (entry.volume24hr < config.minLiquidityUsd) {
    tradeable = false;
    reason = "low liquidity";
  } else if (timeToExpirySec < config.minTimeToExpirySec) {
    tradeable = false;
    reason = "near expiry";
  } else if (absDivergence < config.threshold) {
    reason = "below threshold";
  }

  return {
    conditionId: entry.conditionId,
    question: entry.question,
    pMarket: entry.pMarket,
    pSentiment: entry.pSentiment,
    divergence: entry.divergence,
    absDivergence,
    volume24hr: entry.volume24hr,
    tradeable,
    reason,
  };
}

export function rankAlerts(
  markets: MarketEntry[],
  config: DivergenceConfig,
  limit = 20,
): DivergenceAlert[] {
  return markets
    .map((m) => scoreMarket(m, config))
    .sort((a, b) => b.absDivergence - a.absDivergence)
    .slice(0, limit);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
