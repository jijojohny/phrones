import type { Opportunity } from "@phronesis/shared";

interface LlmResponseShape {
  thesis?: string;
  ranked_opportunities?: Array<{
    conditionId?: string;
    side?: string;
    confidence?: number;
    thesis?: string;
    pModel?: number;
  }>;
}

export function parseLlmOpportunities(raw: string): Opportunity[] {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as LlmResponseShape;
  const rows = parsed.ranked_opportunities ?? [];

  return rows
    .filter((r) => r.conditionId && r.side && r.side !== "HOLD")
    .map((r) => ({
      conditionId: String(r.conditionId),
      question: "",
      side: normalizeSide(String(r.side)),
      confidence: clamp(Number(r.confidence ?? 0.5), 0, 1),
      thesis: String(r.thesis ?? parsed.thesis ?? ""),
      pModel: clamp(Number(r.pModel ?? 0.5), 0.01, 0.99),
    }));
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  throw new Error("LLM response did not contain JSON");
}

function normalizeSide(side: string): Opportunity["side"] {
  const s = side.toUpperCase();
  if (s === "BUY_YES" || s === "YES") return "BUY_YES";
  if (s === "BUY_NO" || s === "NO") return "BUY_NO";
  return "HOLD";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
