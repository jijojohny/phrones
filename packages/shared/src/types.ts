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

/** Encrypted strategy parameters (loaded at TEE boot). */
export interface StrategyConfig {
  nav: number;
  kellyTheta: number;
  maxPositionPct: number;
  maxGrossExposure: number;
  minBetUsd: number;
  maxDrawdownPct: number;
  minHoursToExpiry: number;
  wMarket: number;
  wModel: number;
  wSentiment: number;
  divergenceThreshold: number;
  minLiquidityUsd: number;
  bannedMarkets: string[];
  categories: string[];
}

export interface Opportunity {
  conditionId: string;
  question: string;
  side: "BUY_YES" | "BUY_NO" | "HOLD";
  confidence: number;
  thesis: string;
  pModel: number;
}

export interface RankedOpportunity extends Opportunity {
  pBlended: number;
  kellyFraction: number;
  wagerUsd: number;
  edge: number;
}

export interface TradeIntent {
  chainId: 137 | 16602;
  target: `0x${string}`;
  calldata: `0x${string}`;
  value: bigint;
  marketRef: string;
  question: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  sizeUsd: number;
  maxSlippage: number;
  kellyFraction: number;
  pBlended: number;
  attestationHash: string;
  ts: number;
}

export interface CognitiveCycleResult {
  cycleId: string;
  ts: number;
  nav: number;
  opportunities: RankedOpportunity[];
  intents: TradeIntent[];
  rejected: Array<{ conditionId: string; reason: string }>;
  llmUsed: boolean;
}

export interface RedactedAuditRecord {
  cycleId: string;
  ts: string;
  nav: number;
  intentCount: number;
  grossExposureUsd: number;
  llmUsed: boolean;
  intentHash: string;
  redacted: true;
}

export interface PaperPosition {
  conditionId: string;
  question: string;
  side: "YES" | "NO";
  entryPrice: number;
  sizeUsd: number;
  entryTs: number;
}

export interface PaperTrade {
  conditionId: string;
  question: string;
  side: "YES" | "NO";
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  pnlUsd: number;
  entryTs: number;
  exitTs: number;
}

export interface BacktestReport {
  startTs: number;
  endTs: number;
  initialNav: number;
  finalNav: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRate: number;
  trades: PaperTrade[];
}

export interface BacktestDay {
  ts: number;
  prices: Record<string, number>;
}
