import type { RankedOpportunity, StrategyConfig } from "@phronesis/shared";

export interface QpAllocationInput {
  mu: number[];
  sigma: number[];
  correlation: number[][];
}

export interface QpAllocationResult {
  weights: number[];
  grossExposure: number;
}

/** Mean-variance QP with correlation penalty — projected gradient solver. */
export function solveMeanVarianceQp(
  input: QpAllocationInput,
  strategy: StrategyConfig,
  riskAversion = 2.0,
): QpAllocationResult {
  const n = input.mu.length;
  if (n === 0) return { weights: [], grossExposure: 0 };

  const w = new Array<number>(n).fill(0);
  const maxPos = strategy.maxPositionPct;
  const maxGross = strategy.maxGrossExposure;
  const step = 0.05;
  const iterations = 400;

  for (let iter = 0; iter < iterations; iter += 1) {
    const grad = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      grad[i] += input.mu[i];
      grad[i] -= 2 * riskAversion * input.sigma[i] ** 2 * w[i];

      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        grad[i] -= riskAversion * 2 * input.correlation[i][j] * input.sigma[i] * input.sigma[j] * w[j];
      }
    }

    for (let i = 0; i < n; i += 1) {
      w[i] = Math.min(maxPos, Math.max(0, w[i] + step * grad[i]));
    }

    const gross = w.reduce((s, x) => s + x, 0);
    if (gross > maxGross) {
      const scale = maxGross / gross;
      for (let i = 0; i < n; i += 1) {
        w[i] *= scale;
      }
    }
  }

  return {
    weights: w,
    grossExposure: w.reduce((s, x) => s + x, 0),
  };
}

export function buildQpInput(opportunities: RankedOpportunity[]): QpAllocationInput {
  const n = opportunities.length;
  const mu = opportunities.map((o) => o.edge * o.confidence);
  const sigma = opportunities.map((o) =>
    Math.max(0.05, Math.min(0.35, 0.08 + Math.abs(o.edge) * 0.5)),
  );

  const correlation: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    correlation[i][i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const rho = tagCorrelation(opportunities[i], opportunities[j]);
      correlation[i][j] = rho;
      correlation[j][i] = rho;
    }
  }

  return { mu, sigma, correlation };
}

function tagCorrelation(a: RankedOpportunity, b: RankedOpportunity): number {
  const tagsA = questionTags(a.question);
  const tagsB = questionTags(b.question);
  if (tagsA.size === 0 || tagsB.size === 0) return 0.15;

  let overlap = 0;
  for (const t of tagsA) {
    if (tagsB.has(t)) overlap += 1;
  }
  const jaccard = overlap / new Set([...tagsA, ...tagsB]).size;
  return jaccard * 0.7;
}

function questionTags(question: string): Set<string> {
  const lower = question.toLowerCase();
  const tags = new Set<string>();
  for (const kw of ["bitcoin", "btc", "fed", "trump", "election", "crypto", "eth", "ai"]) {
    if (lower.includes(kw)) tags.add(kw);
  }
  return tags;
}

export function applyQpWeights(
  opportunities: RankedOpportunity[],
  weights: number[],
  strategy: StrategyConfig,
): RankedOpportunity[] {
  const nav = strategy.nav;
  const out: RankedOpportunity[] = [];

  for (let i = 0; i < opportunities.length; i += 1) {
    const opp = opportunities[i];
    const kellyFraction = weights[i] ?? 0;
    const wagerUsd = kellyFraction * nav;
    if (wagerUsd < strategy.minBetUsd) continue;

    out.push({
      ...opp,
      kellyFraction,
      wagerUsd,
    });
  }

  return out.sort((a, b) => b.wagerUsd - a.wagerUsd);
}
