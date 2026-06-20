export interface MarketTick {
  assetId: string;
  conditionId: string;
  question: string;
  outcome?: string;
  bid?: number;
  ask?: number;
  mid?: number;
  lastTrade?: number;
  pImplied?: number;
  eventType: string;
  ts: number;
}

export interface RootAnchorPayload {
  merkleRoot: string;
  storageRootHash: string;
  blobTxHash?: string;
}

/** Per-market row inside unified Phase 1 state. */
export interface MarketEntry {
  conditionId: string;
  question: string;
  slug: string;
  yesAssetId: string;
  pMarket: number;
  pSentiment: number;
  divergence: number;
  bid?: number;
  ask?: number;
  bidAskSpread: number;
  volume24hr: number;
  sentimentScore: number;
  sentimentConfidence: number;
  sentimentSourceCount: number;
  expiry?: number;
  tags: string[];
  updatedAt: number;
}

/** Snapshot published by the data-plane aggregator. */
export interface MarketState {
  version: number;
  ts: number;
  markets: MarketEntry[];
}

export interface SentimentSignal {
  entityId: string;
  conditionId?: string;
  score: number;
  confidence: number;
  sourceCount: number;
  headline?: string;
  ts: number;
}

export interface DivergenceAlert {
  conditionId: string;
  question: string;
  pMarket: number;
  pSentiment: number;
  divergence: number;
  absDivergence: number;
  volume24hr: number;
  tradeable: boolean;
  reason?: string;
}

export interface DivergenceConfig {
  threshold: number;
  alpha: number;
  minLiquidityUsd: number;
  minTimeToExpirySec: number;
}
