import type { RankedOpportunity, StrategyConfig } from "@phronesis/shared";
import {
  applyQpWeights,
  buildQpInput,
  solveMeanVarianceQp,
} from "./qp-solver.js";

export function allocateMultiMarket(
  opportunities: RankedOpportunity[],
  strategy: StrategyConfig,
): RankedOpportunity[] {
  const candidates = [...opportunities]
    .filter((o) => o.wagerUsd > 0)
    .sort((a, b) => b.edge * b.kellyFraction - a.edge * a.kellyFraction);

  if (candidates.length === 0) return [];
  if (candidates.length === 1) return candidates;

  const qpInput = buildQpInput(candidates);
  const { weights } = solveMeanVarianceQp(qpInput, strategy);
  const allocated = applyQpWeights(candidates, weights, strategy);

  if (allocated.length === 0) {
    return allocateGreedy(candidates, strategy);
  }

  return allocated;
}

/** Greedy fallback when QP returns zero weights. */
function allocateGreedy(
  sorted: RankedOpportunity[],
  strategy: StrategyConfig,
): RankedOpportunity[] {
  const selected: RankedOpportunity[] = [];
  let grossFraction = 0;

  for (const opp of sorted) {
    if (grossFraction + opp.kellyFraction > strategy.maxGrossExposure) {
      const remaining = strategy.maxGrossExposure - grossFraction;
      if (remaining <= 0) break;

      const scaled = scaleOpportunity(opp, remaining / opp.kellyFraction, strategy.nav);
      if (scaled.wagerUsd >= strategy.minBetUsd) {
        selected.push(scaled);
        grossFraction += scaled.kellyFraction;
      }
      break;
    }

    selected.push(opp);
    grossFraction += opp.kellyFraction;
  }

  return selected;
}

function scaleOpportunity(
  opp: RankedOpportunity,
  scale: number,
  nav: number,
): RankedOpportunity {
  const kellyFraction = opp.kellyFraction * scale;
  return {
    ...opp,
    kellyFraction,
    wagerUsd: kellyFraction * nav,
  };
}

export function grossExposureUsd(opportunities: RankedOpportunity[]): number {
  return opportunities.reduce((sum, o) => sum + o.wagerUsd, 0);
}
