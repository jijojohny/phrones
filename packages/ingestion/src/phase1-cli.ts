#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@phronesis/shared";
import type { DivergenceConfig } from "@phronesis/shared";
import { demoX402Call } from "@phronesis/x402-client";
import { rankAlerts } from "./anomaly/divergence.js";
import { MarketStateStore } from "./aggregator/store.js";
import { tryEnrichFromBitquery } from "./bitquery/graphql.js";
import {
  collectAssetIds,
  fetchActiveMarkets,
  type ActiveMarket,
} from "./polymarket/markets.js";
import { PolymarketClobWs } from "./polymarket/clob-ws.js";
import { runSentimentPipeline } from "./sentiment/pipeline.js";

const args = process.argv.slice(2);
const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function argNum(prefix: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`${prefix}=`))?.split("=")[1];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

const marketCount = argNum("--markets", 50);
const durationSec = argNum("--duration", 120);
const refreshSec = argNum("--refresh", 5);
const sentimentPollSec = argNum("--sentiment-poll", 60);
const runX402Demo = args.includes("--x402-demo");
const sentimentOnly = args.includes("--sentiment-only");
const useFixture = args.includes("--fixture");

const divergenceConfig: DivergenceConfig = {
  threshold: env.divergenceThreshold,
  alpha: env.sentimentAlpha,
  minLiquidityUsd: env.minLiquidityUsd,
  minTimeToExpirySec: env.minTimeToExpirySec,
};

function formatTable(alerts: ReturnType<typeof rankAlerts>): string {
  const header = [
    "DIVERG",
    "p_mkt",
    "p_sent",
    "vol24h",
    "FLAG",
    "QUESTION",
  ];
  const rows = alerts.map((a) => [
    a.divergence >= 0 ? `+${a.divergence.toFixed(3)}` : a.divergence.toFixed(3),
    a.pMarket.toFixed(3),
    a.pSentiment.toFixed(3),
    a.volume24hr >= 1000 ? `${Math.round(a.volume24hr / 1000)}k` : String(a.volume24hr),
    a.tradeable ? "YES" : "—",
    a.question.slice(0, 56),
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );

  const line = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ");

  return [line(header), line(widths.map((w) => "─".repeat(w))), ...rows.map(line)].join("\n");
}

function loadFixtureMarkets(): ActiveMarket[] {
  const path = resolve(pkgRoot, "fixtures/sample-markets.json");
  return JSON.parse(readFileSync(path, "utf8")) as ActiveMarket[];
}

async function loadMarkets(count: number): Promise<ActiveMarket[]> {
  if (useFixture) {
    console.log("[fixture] using sample-markets.json (offline mode)");
    return loadFixtureMarkets();
  }
  return fetchActiveMarkets(count);
}

async function refreshSentiment(
  store: MarketStateStore,
  markets: Awaited<ReturnType<typeof fetchActiveMarkets>>,
): Promise<void> {
  const signals = await runSentimentPipeline(markets);
  store.applySentiment(signals);
  console.log(`[sentiment] updated ${signals.length} market signals`);
}

async function main() {
  console.log("=== Phronesis Phase 1 — Data Plane MVP ===\n");
  console.log(
    `Markets=${marketCount}  duration=${durationSec}s  refresh=${refreshSec}s  τ=${divergenceConfig.threshold}`,
  );

  if (runX402Demo) {
    await demoX402Call();
  }

  console.log(`\nFetching top ${marketCount} active Polymarket markets...`);
  const markets = await loadMarkets(marketCount);
  if (markets.length === 0) throw new Error("No active markets from Gamma API");

  const store = new MarketStateStore(divergenceConfig.alpha);
  store.bootstrap(markets);
  console.log(`Bootstrapped ${store.size()} markets`);

  await tryEnrichFromBitquery(env.bitqueryApiKey);
  await refreshSentiment(store, markets);

  if (sentimentOnly || useFixture) {
    const snapshot = store.snapshot();
    console.log(formatTable(rankAlerts(snapshot.markets, divergenceConfig, 25)));
    return;
  }

  const assetIds = collectAssetIds(markets, marketCount * 2);
  console.log(`\nSubscribing to ${assetIds.length} outcome tokens via CLOB WS...\n`);

  let tickCount = 0;
  const ws = new PolymarketClobWs({
    assetIds,
    onTick: (tick) => {
      if (store.applyTick(tick)) tickCount += 1;
    },
    onError: (err) => console.error("[clob-ws]", err.message),
  });

  ws.connect();

  const printDashboard = () => {
    const snapshot = store.snapshot();
    const alerts = rankAlerts(snapshot.markets, divergenceConfig, 15);
    const tradeable = alerts.filter((a) => a.tradeable).length;

    console.clear();
    console.log(`=== Market State v${snapshot.version} | ticks=${tickCount} | tradeable=${tradeable} ===`);
    console.log(formatTable(alerts));
    console.log(`\nUpdated ${new Date(snapshot.ts).toISOString()}  (Ctrl+C to stop)`);
  };

  printDashboard();
  const refreshTimer = setInterval(printDashboard, refreshSec * 1000);
  const sentimentTimer = setInterval(
    () => refreshSentiment(store, markets).catch(console.error),
    sentimentPollSec * 1000,
  );

  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

  clearInterval(refreshTimer);
  clearInterval(sentimentTimer);
  ws.close();

  const final = store.snapshot();
  console.log(`\n=== Final snapshot (${final.markets.length} markets, ${tickCount} ticks) ===`);
  console.log(formatTable(rankAlerts(final.markets, divergenceConfig, 20)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
