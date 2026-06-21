import type { VaultMetrics } from "@phronesis/shared";

export interface OperatorMarketRow {
  conditionId: string;
  question: string;
  pMarket: number;
  pSentiment: number;
  divergence: number;
}

export interface BetaRequestRow {
  address: string;
  email: string | null;
  ts: string;
}

export interface PreflightRow {
  label: string;
  ok: boolean;
  required: boolean;
  detail?: string;
}

export interface OperatorStatus {
  ts: number;
  fund: {
    address: string;
    nav: number;
    navPerShare: number;
    totalAssets: string;
    totalAssetsOg: string;
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
  betaRequests: BetaRequestRow[];
  preflight: { passed: boolean; checks: PreflightRow[] };
  compliance: { blockers: number; jurisdiction: string };
}
