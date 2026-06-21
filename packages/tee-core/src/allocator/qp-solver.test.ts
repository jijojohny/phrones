import assert from "node:assert/strict";
import type { RankedOpportunity, StrategyConfig } from "@phronesis/shared";
import { allocateMultiMarket } from "./multi-market.js";
import { applyQpWeights, buildQpInput, solveMeanVarianceQp } from "./qp-solver.js";

const strategy: StrategyConfig = {
  nav: 10_000,
  kellyTheta: 0.5,
  maxPositionPct: 0.1,
  maxGrossExposure: 0.5,
  minBetUsd: 25,
  maxDrawdownPct: 0.15,
  minHoursToExpiry: 24,
  wMarket: 0.4,
  wModel: 0.35,
  wSentiment: 0.25,
  divergenceThreshold: 0.08,
  minLiquidityUsd: 10_000,
  bannedMarkets: [],
  categories: ["crypto"],
};

function opp(
  id: string,
  edge: number,
  conf: number,
  kelly: number,
  question: string,
): RankedOpportunity {
  return {
    conditionId: id,
    question,
    side: "BUY_YES",
    confidence: conf,
    thesis: "",
    pModel: 0.55,
    pBlended: 0.55,
    kellyFraction: kelly,
    wagerUsd: kelly * strategy.nav,
    edge,
  };
}

// Golden vector 1: gross exposure capped at 50%
const three = [
  opp("a", 0.12, 0.9, 0.2, "bitcoin etf approval"),
  opp("b", 0.10, 0.8, 0.2, "fed rate cut march"),
  opp("c", 0.08, 0.7, 0.2, "trump nomination"),
];
const allocated = allocateMultiMarket(three, strategy);
const gross = allocated.reduce((s, o) => s + o.kellyFraction, 0);
assert.ok(gross <= strategy.maxGrossExposure + 1e-6, `gross ${gross} exceeds cap`);
assert.ok(allocated.length >= 2, "should select multiple markets");

// Golden vector 2: QP prefers higher edge
const qpInput = buildQpInput([
  opp("x", 0.15, 1, 0.08, "bitcoin"),
  opp("y", 0.05, 1, 0.08, "fed"),
]);
const { weights } = solveMeanVarianceQp(qpInput, strategy);
assert.ok(weights[0] >= weights[1], "higher edge should get >= weight");

// Golden vector 3: min bet filter
const tiny = applyQpWeights(
  [opp("z", 0.01, 0.5, 0.001, "niche market")],
  [0.001],
  strategy,
);
assert.equal(tiny.length, 0, "below minBetUsd should be filtered");

console.log("QP allocator tests passed (3 vectors)");
