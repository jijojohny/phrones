import type { MarketEntry, Opportunity } from "@phronesis/shared";

/** Rule-based fallback when LLM unavailable (uses divergence signal). */
export function rankWithRules(markets: MarketEntry[], threshold: number): Opportunity[] {
  return markets
    .filter((m) => Math.abs(m.divergence) >= threshold)
    .map((m) => {
      const buyYes = m.divergence > 0;
      const pModel = buyYes
        ? Math.min(0.99, m.pMarket + Math.abs(m.divergence))
        : Math.max(0.01, m.pMarket - Math.abs(m.divergence));

      return {
        conditionId: m.conditionId,
        question: m.question,
        side: buyYes ? "BUY_YES" : "BUY_NO",
        confidence: Math.min(1, Math.abs(m.divergence) / 0.2),
        thesis: buyYes
          ? `Sentiment exceeds market by ${m.divergence.toFixed(3)}`
          : `Market exceeds sentiment by ${Math.abs(m.divergence).toFixed(3)}`,
        pModel,
      } satisfies Opportunity;
    });
}
