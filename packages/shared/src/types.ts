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
