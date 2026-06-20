import type { ActiveMarket } from "../polymarket/markets.js";
import type { SentimentSignal } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { fetchCryptoPanicPosts, postToScore } from "./cryptopanic.js";
import { keywordOverlap, lexiconScore } from "./lexicon.js";

const MATCH_THRESHOLD = 0.15;

export async function runSentimentPipeline(
  markets: ActiveMarket[],
): Promise<SentimentSignal[]> {
  const signals: SentimentSignal[] = [];

  for (const m of markets) {
    const { score, confidence } = lexiconScore(m.question);
    if (confidence > 0) {
      signals.push({
        entityId: m.slug,
        conditionId: m.conditionId,
        score,
        confidence: confidence * 0.5,
        sourceCount: 1,
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
  } else {
    console.warn("[sentiment] CRYPTOPANIC_API_KEY not set — using question lexicon only");
  }

  return mergeSignals(signals);
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
      if (overlap < MATCH_THRESHOLD) continue;

      out.push({
        entityId: m.slug,
        conditionId: m.conditionId,
        score: blendedScore,
        confidence: blendedConf * Math.min(1, overlap * 2),
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
