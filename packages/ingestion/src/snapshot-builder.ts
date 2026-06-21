import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@phronesis/shared";
import type { MarketState, VaultMetrics } from "@phronesis/shared";
import { MarketStateStore } from "./aggregator/store.js";
import { rankAlerts } from "./anomaly/divergence.js";
import {
  collectAssetIds,
  fetchActiveMarkets,
  type ActiveMarket,
} from "./polymarket/markets.js";
import { PolymarketClobWs } from "./polymarket/clob-ws.js";
import { runSentimentPipeline } from "./sentiment/pipeline.js";
import { indexVaults, loadVaultConfig } from "./vaults/index.js";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export interface SnapshotOptions {
  marketCount?: number;
  fixture?: boolean;
  wsCollectSec?: number;
  includeVaults?: boolean;
}

export async function buildMarketSnapshot(opts: SnapshotOptions = {}): Promise<MarketState> {
  const marketCount = opts.marketCount ?? 50;
  const fixture = opts.fixture ?? false;
  const wsCollectSec = opts.wsCollectSec ?? 20;

  if (fixture) {
    const state = loadTeeFixtureSnapshot();
    const fresh = {
      ...state,
      ts: Date.now(),
      markets: state.markets.map((m) => ({ ...m, updatedAt: Date.now() })),
    };
    if (opts.includeVaults !== false) {
      try {
        const vaults = await indexVaults(loadVaultConfig());
        return { ...fresh, vaults };
      } catch {
        return fresh;
      }
    }
    return fresh;
  }

  const markets = await fetchActiveMarkets(marketCount);
  if (markets.length === 0) throw new Error("No markets available for snapshot");

  const store = new MarketStateStore(env.sentimentAlpha);
  store.bootstrap(markets);

  const { signals } = await runSentimentPipeline(markets);
  store.applySentiment(signals);

  if (!fixture && wsCollectSec > 0) {
    await collectWsTicks(store, markets, marketCount, wsCollectSec);
  }

  if (opts.includeVaults !== false) {
    try {
      const vaults = await indexVaults(loadVaultConfig());
      store.setVaults(vaults);
    } catch {
      // vault config optional offline
    }
  }

  return store.snapshot();
}

function loadTeeFixtureSnapshot(): MarketState {
  const teePath = resolve(pkgRoot, "../tee-core/fixtures/market-snapshot.json");
  return JSON.parse(readFileSync(teePath, "utf8")) as MarketState;
}

function loadFixtureMarkets(): ActiveMarket[] {
  const path = resolve(pkgRoot, "fixtures/sample-markets.json");
  return JSON.parse(readFileSync(path, "utf8")) as ActiveMarket[];
}

function loadTeeFixtureMarkets(): ActiveMarket[] {
  const teePath = resolve(pkgRoot, "../tee-core/fixtures/market-snapshot.json");
  const snapshot = JSON.parse(readFileSync(teePath, "utf8")) as {
    markets: Array<{
      conditionId: string;
      question: string;
      slug: string;
      yesAssetId: string;
      pMarket: number;
      volume24hr: number;
      expiry?: number;
      tags: string[];
    }>;
  };
  return snapshot.markets.map((m) => ({
    id: m.conditionId,
    conditionId: m.conditionId,
    question: m.question,
    slug: m.slug,
    tokenIds: [m.yesAssetId],
    prices: [m.pMarket],
    outcomes: ["Yes", "No"],
    volume24hr: m.volume24hr,
    endDate: m.expiry,
    tags: m.tags,
  }));
}

async function collectWsTicks(
  store: MarketStateStore,
  markets: ActiveMarket[],
  marketCount: number,
  durationSec: number,
): Promise<void> {
  const assetIds = collectAssetIds(markets, marketCount * 2);
  if (assetIds.length === 0) return;

  const ws = new PolymarketClobWs({
    assetIds,
    onTick: (tick) => {
      store.applyTick(tick);
    },
    onError: () => {},
  });

  ws.connect();
  await new Promise((r) => setTimeout(r, durationSec * 1000));
  ws.close();
}

export function topTradeableCount(state: MarketState): number {
  return rankAlerts(state.markets, {
    threshold: env.divergenceThreshold,
    alpha: env.sentimentAlpha,
    minLiquidityUsd: env.minLiquidityUsd,
    minTimeToExpirySec: env.minTimeToExpirySec,
  }).filter((a) => a.tradeable).length;
}

export type { VaultMetrics };
