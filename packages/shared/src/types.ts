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

/** Vault metrics from ERC-4626 / Polymarket LP / Underlay adapters. */
export interface VaultMetrics {
  protocol: string;
  vaultAddress: string;
  chainId: number;
  totalAssets: string;
  totalSupply: string;
  sharePrice: number;
  utilization: number;
  openInterest?: string;
  strategyExposure: Record<string, number>;
  lastUpdated: number;
}

/** Snapshot published by the data-plane aggregator. */
export interface MarketState {
  version: number;
  ts: number;
  markets: MarketEntry[];
  vaults?: VaultMetrics[];
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

/** Phase 1 feed health metrics for Grafana / Prometheus. */
export interface FeedHealthMetrics {
  ts: number;
  marketCount: number;
  tickCount: number;
  missedTicks: number;
  reconnects: number;
  gapFills: number;
  avgLagMs: number;
  maxLagMs: number;
  sentimentSource: "lexicon" | "finbert" | "hybrid";
  redisPublished: boolean;
  timescalePublished: boolean;
  kafkaEvents: number;
}

export interface EncryptedMarketStateBundle {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  metadataHash: string;
  version: number;
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
  /** EIP-712 signature when TEE signer key configured */
  signature?: `0x${string}`;
  signerAddress?: `0x${string}`;
  intentHash?: `0x${string}`;
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

/** ERC-4337 / session key policy mirror (off-chain + on-chain hooks). */
export interface SessionKeyPolicy {
  validUntil: number;
  dailyLimitUsdc: number;
  perTxLimitUsdc: number;
  allowedContracts: string[];
  allowedSelectors: string[];
  maxNavUsdc: number;
}

export interface PolymarketOrder {
  tokenId: string;
  conditionId: string;
  question: string;
  price: number;
  sizeShares: number;
  sizeUsd: number;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  maxSlippage: number;
}

export interface PolicyViolation {
  intentIndex: number;
  marketRef: string;
  rule: string;
  message: string;
}

export interface PolicyCheckResult {
  ok: boolean;
  violations: PolicyViolation[];
  approvedIntents: TradeIntent[];
}

export interface ExecutionResult {
  mode: "dry-run" | "live";
  cycleId: string;
  ts: number;
  orders: PolymarketOrder[];
  submitted: number;
  skipped: number;
  violations: PolicyViolation[];
  orderIds: string[];
  errors: string[];
}

export interface FillEvent {
  orderId: string;
  tokenId: string;
  conditionId: string;
  side: "BUY" | "SELL";
  price: number;
  sizeShares: number;
  ts: number;
  status: "matched" | "partial" | "cancelled";
}

export interface RelayerResult {
  policy: PolicyCheckResult;
  execution: ExecutionResult;
  attestationValid: boolean;
}

/** Investor permissions for authorizeUsage (stored on-chain as JSON bytes). */
export interface InvestorPermissions {
  role: "investor" | "auditor";
  expiresAt: number;
  allowedOperations: string[];
  deniedOperations: string[];
  rateLimit?: { maxRequestsPerDay: number };
}

/** Public performance report (no strategy leakage). */
export interface PerformanceReport {
  nav: number;
  navPerShare: number;
  totalAssets: string;
  pnl24h: number;
  pnl30d: number;
  sharpe: number;
  maxDrawdown: number;
  tradeCount: number;
  lastAuditRoot: string;
  lastStorageHash?: string;
  auditVerified?: boolean;
  auditTs?: number;
  shareSupply: string;
  investorShares?: string;
  ts: number;
}

export interface FundMetadata {
  version: string;
  model: { provider: string; modelId: string; weightsHash: string };
  prompts: { system: string; mandate: string };
  riskParams: {
    theta: number;
    maxDrawdown: number;
    maxPositionPct: number;
    divergenceThreshold: number;
  };
  memoryRoot: string;
  createdAt: number;
}

export interface EncryptedMetadataBundle {
  metadataHash: string;
  encryptedURI: string;
  iv: string;
  authTag: string;
  algorithm: "aes-256-gcm";
}

/** AES-256-GCM encrypted strategy config (TEE boot loader). */
export interface EncryptedStrategyBundle {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  metadataHash: string;
  version: number;
  ts: number;
}

/** TEE attestation quote for external auditors. */
export interface AttestationQuote {
  provider: string;
  quoteHash: string;
  verified: boolean;
  mode: "teeml" | "teetls" | "local";
  ts: number;
  expiresAt: number;
  details?: string;
}

/** EIP-712 cross-chain intent (0G control → Polygon execution). */
export interface CrossChainIntent {
  intentHash: string;
  cycleId: string;
  targetChainId: 137 | 16602;
  marketRef: string;
  question: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  sizeUsd: number;
  maxSlippage: number;
  attestationHash: string;
  ts: number;
}

export interface RelaySubmission {
  intentHash: string;
  signer: string;
  targetChainId: number;
  marketRef: string;
  submittedAt: number;
  executed: boolean;
  executionTxHash?: string;
}

export interface RelayerStatus {
  pending: number;
  executed: number;
  lastRelayAt?: number;
  bridgeAddress?: string;
}

/** ERC-7857 transfer bundle from TEE oracle re-encryption. */
export interface TransferBundle {
  proof: string;
  proofHash: string;
  oldMetadataHash: string;
  newMetadataHash: string;
  newEncryptedURI: string;
  sealedKey: string;
  receiverHasAccess: boolean;
}

export interface CloneBundle extends TransferBundle {
  sourceTokenId: number;
  newTokenId?: number;
}
