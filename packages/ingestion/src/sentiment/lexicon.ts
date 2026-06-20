const POSITIVE = new Set([
  "surge",
  "win",
  "wins",
  "approve",
  "approved",
  "bullish",
  "gain",
  "gains",
  "rise",
  "rises",
  "success",
  "successful",
  "yes",
  "record",
  "high",
  "growth",
  "boost",
  "rally",
  "breakthrough",
  "positive",
]);

const NEGATIVE = new Set([
  "crash",
  "lose",
  "loses",
  "lost",
  "reject",
  "rejected",
  "bearish",
  "fall",
  "falls",
  "fail",
  "failed",
  "failure",
  "no",
  "scandal",
  "crisis",
  "decline",
  "drop",
  "drops",
  "negative",
  "lawsuit",
  "ban",
  "banned",
]);

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "is",
  "will",
  "be",
  "by",
  "with",
  "from",
  "as",
  "that",
  "this",
  "it",
  "its",
  "before",
  "after",
  "than",
  "into",
  "over",
  "under",
  "between",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function lexiconScore(text: string): { score: number; confidence: number } {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { score: 0, confidence: 0 };

  let pos = 0;
  let neg = 0;
  for (const t of tokens) {
    if (POSITIVE.has(t)) pos += 1;
    if (NEGATIVE.has(t)) neg += 1;
  }

  const hits = pos + neg;
  if (hits === 0) return { score: 0, confidence: 0.1 };

  const score = (pos - neg) / (hits + 1);
  const confidence = Math.min(1, 0.3 + hits / tokens.length);
  return { score: clamp(score, -1, 1), confidence };
}

export function keywordOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  let overlap = 0;
  for (const w of ta) {
    if (tb.has(w)) overlap += 1;
  }
  return overlap / Math.sqrt(ta.size * tb.size);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
