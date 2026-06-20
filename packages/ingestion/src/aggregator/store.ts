import type { ActiveMarket } from "../polymarket/markets.js";
import type { MarketEntry, MarketState, MarketTick, SentimentSignal } from "@phronesis/shared";
import { sentimentImpliedP } from "../anomaly/divergence.js";

export class MarketStateStore {
  private readonly markets = new Map<string, MarketEntry>();
  private readonly assetToCondition = new Map<string, string>();
  private version = 0;
  private readonly alpha: number;

  constructor(alpha: number) {
    this.alpha = alpha;
  }

  bootstrap(activeMarkets: ActiveMarket[]): void {
    this.markets.clear();
    this.assetToCondition.clear();

    for (const m of activeMarkets) {
      const yesAssetId = m.tokenIds[0];
      if (!yesAssetId) continue;

      const pMarket = clamp(m.prices[0] ?? 0.5, 0.01, 0.99);
      this.assetToCondition.set(yesAssetId, m.conditionId);

      this.markets.set(m.conditionId, {
        conditionId: m.conditionId,
        question: m.question,
        slug: m.slug,
        yesAssetId,
        pMarket,
        pSentiment: pMarket,
        divergence: 0,
        bidAskSpread: 0,
        volume24hr: m.volume24hr,
        sentimentScore: 0,
        sentimentConfidence: 0,
        sentimentSourceCount: 0,
        expiry: m.endDate,
        tags: m.tags,
        updatedAt: Date.now(),
      });
    }
    this.version += 1;
  }

  applyTick(tick: MarketTick): boolean {
    const conditionId =
      tick.conditionId || this.assetToCondition.get(tick.assetId) || "";
    if (!conditionId) return false;

    const entry = this.markets.get(conditionId);
    if (!entry) return false;

    const p = tick.pImplied ?? tick.mid ?? tick.lastTrade;
    if (p === undefined) return false;

    entry.pMarket = clamp(p, 0.01, 0.99);
    if (tick.bid !== undefined) entry.bid = tick.bid;
    if (tick.ask !== undefined) entry.ask = tick.ask;
    if (entry.bid !== undefined && entry.ask !== undefined) {
      entry.bidAskSpread = Math.max(0, entry.ask - entry.bid);
    }

    this.refreshDivergence(entry);
    entry.updatedAt = tick.ts || Date.now();
    this.version += 1;
    return true;
  }

  applySentiment(signals: SentimentSignal[]): void {
    const byCondition = new Map<string, SentimentSignal[]>();
    for (const s of signals) {
      if (!s.conditionId) continue;
      const list = byCondition.get(s.conditionId) ?? [];
      list.push(s);
      byCondition.set(s.conditionId, list);
    }

    for (const [conditionId, list] of byCondition) {
      const entry = this.markets.get(conditionId);
      if (!entry) continue;

      const totalWeight = list.reduce((sum, s) => sum + s.confidence * s.sourceCount, 0);
      const score =
        totalWeight > 0
          ? list.reduce((sum, s) => sum + s.score * s.confidence * s.sourceCount, 0) /
            totalWeight
          : 0;
      const confidence = Math.min(
        1,
        list.reduce((sum, s) => sum + s.confidence, 0) / list.length,
      );

      entry.sentimentScore = score;
      entry.sentimentConfidence = confidence;
      entry.sentimentSourceCount = list.reduce((sum, s) => sum + s.sourceCount, 0);
      this.refreshDivergence(entry);
      entry.updatedAt = Date.now();
    }

    this.version += 1;
  }

  snapshot(): MarketState {
    return {
      version: this.version,
      ts: Date.now(),
      markets: [...this.markets.values()].sort(
        (a, b) => Math.abs(b.divergence) - Math.abs(a.divergence),
      ),
    };
  }

  size(): number {
    return this.markets.size;
  }

  private refreshDivergence(entry: MarketEntry): void {
    entry.pSentiment = sentimentImpliedP(
      entry.pMarket,
      entry.sentimentScore,
      entry.sentimentConfidence,
      this.alpha,
    );
    entry.divergence = entry.pSentiment - entry.pMarket;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
