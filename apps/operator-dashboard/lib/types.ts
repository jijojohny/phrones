import type { VaultMetrics } from "@phronesis/shared";

export interface OperatorMarketRow {
  conditionId: string;
  question: string;
  pMarket: number;
  pSentiment: number;
  divergence: number;
}

export interface OperatorStatus {
  ts: number;
  fund: {
    address: string;
    nav: number;
    totalAssets: string;
    shareSupply: string;
  };
  feed: {
    marketCount: number;
    topDivergence: number;
    healthy: boolean;
  };
  relayer: {
    pending: number;
    executed: number;
    mode: string;
    bridgeAddress: string;
  };
  agent: {
    tokenId: number;
    metadataHash: string;
    oracleConfigured: boolean;
  };
  vaults: VaultMetrics[];
  markets: OperatorMarketRow[];
}
