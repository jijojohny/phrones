export function blendProbability(
  pMarket: number,
  pModel: number,
  pSentiment: number,
  weights: { wMarket: number; wModel: number; wSentiment: number },
): number {
  const sum = weights.wMarket + weights.wModel + weights.wSentiment;
  if (sum <= 0) return clamp(pMarket, 0.01, 0.99);

  const blended =
    (weights.wMarket * pMarket +
      weights.wModel * pModel +
      weights.wSentiment * pSentiment) /
    sum;

  return clamp(blended, 0.01, 0.99);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
