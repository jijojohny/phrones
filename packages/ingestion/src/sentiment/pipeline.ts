import type { ActiveMarket } from "../polymarket/markets.js";
import type { SentimentSignal } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { fetchCryptoPanicPosts, postToScore } from "./cryptopanic.js";
import { entityKeywordBoost, matchMarketToEntities } from "./entity-map.js";
import { isFinbertReady, scoreWithFinbert } from "./finbert.js";
import { keywordOverlap, lexiconScore } from "./lexicon.js";

const MATCH_THRESHOLD = 0.15;

export type SentimentSource = "lexicon" | "finbert" | "hybrid";

export async function runSentimentPipeline(
  markets: ActiveMarket[],
): Promise<{ signals: SentimentSignal[]; source: SentimentSource }> {
  const signals: SentimentSignal[] = [];
  let usedFinbert = false;

  for (const m of markets) {
    const entities = matchMarketToEntities(m);
    const lex = lexiconScore(m.question);
    const fin = env.finbertEnabled ? await scoreWithFinbert(m.question) : null;
    if (fin) usedFinbert = true;

    const entityBoost = entityKeywordBoost(m.question, entities);
    const score = fin ? fin.score * 0.6 + lex.score * 0.4 : lex.score;
    const confidence = Math.min(
      1,
      (fin?.confidence ?? lex.confidence * 0.5) + entityBoost * 0.2,
    );

    if (confidence > 0) {
      signals.push({
        entityId: entities[0]?.entityId ?? m.slug,
        conditionId: m.conditionId,
        score,
        confidence,
        sourceCount: fin ? 2 : 1,
        headline: m.question,
        ts: Date.now(),
      });
    }
  }

  if (env.cryptopanicApiKey) {
    try {
      const posts = await fetchCryptoPanicPosts(env.cryptopanicApiKey);
      signals.push(...mapPostsToMarkets(posts, markets));
    } catch (err) {
      console.warn(
        "[sentiment] CryptoPanic fetch failed:",
        err instanceof Error ? err.message : err,
      );
    }
  } else if (!env.finbertEnabled) {
    console.warn("[sentiment] CRYPTOPANIC_API_KEY not set — using question lexicon only");
  }

  const merged = mergeSignals(signals);
  const source: SentimentSource = usedFinbert
    ? isFinbertReady()
      ? "finbert"
      : "hybrid"
    : "lexicon";

  return { signals: merged, source };
}

function mapPostsToMarkets(
  posts: Awaited<ReturnType<typeof fetchCryptoPanicPosts>>,
  markets: ActiveMarket[],
): SentimentSignal[] {
  const out: SentimentSignal[] = [];
  const ts = Date.now();

  for (const post of posts) {
    const { score, confidence: baseConf } = postToScore(post);
    const headlineScore = lexiconScore(post.title);
    const blendedScore = score !== 0 ? score : headlineScore.score;
    const blendedConf = Math.max(baseConf, headlineScore.confidence);

    for (const m of markets) {
      const overlap = keywordOverlap(post.title, m.question);
      const entities = matchMarketToEntities(m);
      const entityOverlap = entityKeywordBoost(post.title, entities);
      if (overlap < MATCH_THRESHOLD && entityOverlap < 0.25) continue;

      out.push({
        entityId: entities[0]?.entityId ?? m.slug,
        conditionId: m.conditionId,
        score: blendedScore,
        confidence: blendedConf * Math.min(1, overlap * 2 + entityOverlap),
        sourceCount: 1,
        headline: post.title,
        ts,
      });
    }
  }

  return out;
}

function mergeSignals(signals: SentimentSignal[]): SentimentSignal[] {
  const byCondition = new Map<string, SentimentSignal[]>();
  for (const s of signals) {
    if (!s.conditionId) continue;
    const list = byCondition.get(s.conditionId) ?? [];
    list.push(s);
    byCondition.set(s.conditionId, list);
  }

  const merged: SentimentSignal[] = [];
  for (const [conditionId, list] of byCondition) {
    const totalWeight = list.reduce((sum, s) => sum + s.confidence, 0);
    const score =
      totalWeight > 0
        ? list.reduce((sum, s) => sum + s.score * s.confidence, 0) / totalWeight
        : 0;
    const confidence = Math.min(1, list.reduce((sum, s) => sum + s.confidence, 0));

    merged.push({
      entityId: list[0]?.entityId ?? conditionId,
      conditionId,
      score,
      confidence,
      sourceCount: list.length,
      headline: list.find((s) => s.headline)?.headline,
      ts: Date.now(),
    });
  }

  return merged;
}
