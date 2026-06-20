import type { CognitiveCycleResult, RedactedAuditRecord, TradeIntent } from "@phronesis/shared";
import { hashIntents } from "../pipeline/cognitive.js";

export function buildRedactedAuditRecord(result: CognitiveCycleResult): RedactedAuditRecord {
  const grossExposureUsd = result.intents.reduce((s, i) => s + i.sizeUsd, 0);
  return {
    cycleId: result.cycleId,
    ts: new Date(result.ts).toISOString(),
    nav: result.nav,
    intentCount: result.intents.length,
    grossExposureUsd,
    llmUsed: result.llmUsed,
    intentHash: hashIntents(result.intents),
    redacted: true,
  };
}

export function summarizeIntents(intents: TradeIntent[]): string {
  if (intents.length === 0) return "No trade intents generated.";

  return intents
    .map(
      (i) =>
        `- ${i.outcome} ${i.question.slice(0, 48)} | $${i.sizeUsd.toFixed(0)} | kelly=${(i.kellyFraction * 100).toFixed(1)}% | p=${i.pBlended.toFixed(3)}`,
    )
    .join("\n");
}
