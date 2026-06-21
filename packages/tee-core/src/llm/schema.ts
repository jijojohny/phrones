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
  exit_signals?: unknown[];
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
  parsed?: LlmResponseShape;
}

export function validateLlmResponse(raw: string): SchemaValidationResult {
  const errors: string[] = [];

  let parsed: LlmResponseShape;
  try {
    const json = extractJson(raw);
    parsed = JSON.parse(json) as LlmResponseShape;
  } catch (err) {
    return {
      ok: false,
      errors: [`invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (typeof parsed.thesis !== "string" && parsed.thesis !== undefined) {
    errors.push("thesis must be a string");
  }

  if (!Array.isArray(parsed.ranked_opportunities)) {
    errors.push("ranked_opportunities must be an array");
    return { ok: false, errors, parsed };
  }

  for (const [i, row] of parsed.ranked_opportunities.entries()) {
    if (!row.conditionId) errors.push(`ranked_opportunities[${i}].conditionId required`);
    if (!row.side) errors.push(`ranked_opportunities[${i}].side required`);
    const side = String(row.side).toUpperCase();
    if (!["BUY_YES", "BUY_NO", "YES", "NO", "HOLD"].includes(side)) {
      errors.push(`ranked_opportunities[${i}].side invalid: ${row.side}`);
    }
    const conf = Number(row.confidence ?? 0.5);
    if (conf < 0 || conf > 1) errors.push(`ranked_opportunities[${i}].confidence out of range`);
    const pModel = Number(row.pModel ?? 0.5);
    if (pModel <= 0 || pModel >= 1) errors.push(`ranked_opportunities[${i}].pModel out of range`);
  }

  return { ok: errors.length === 0, errors, parsed };
}

export function parseValidatedOpportunities(raw: string): Opportunity[] {
  const validation = validateLlmResponse(raw);
  if (!validation.ok || !validation.parsed) {
    throw new Error(`LLM schema validation failed: ${validation.errors.join("; ")}`);
  }

  const rows = validation.parsed.ranked_opportunities ?? [];
  return rows
    .filter((r) => r.conditionId && r.side && String(r.side).toUpperCase() !== "HOLD")
    .map((r) => ({
      conditionId: String(r.conditionId),
      question: "",
      side: normalizeSide(String(r.side)),
      confidence: clamp(Number(r.confidence ?? 0.5), 0, 1),
      thesis: String(r.thesis ?? validation.parsed?.thesis ?? ""),
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
