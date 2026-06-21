#!/usr/bin/env node
import { env } from "@phronesis/shared";
import type { DivergenceConfig } from "@phronesis/shared";
import { demoX402Call } from "@phronesis/x402-client";
import { rankAlerts } from "./anomaly/divergence.js";
import { MarketStateStore } from "./aggregator/store.js";
import { tryEnrichFromBitquery } from "./bitquery/graphql.js";
import { startKafkaConsumer } from "./bitquery/kafka-consumer.js";
import { loadFixtureMarkets } from "./fixtures/expand-markets.js";
import { FeedHealthTracker } from "./metrics/feed-health.js";
import { startMetricsServer } from "./metrics/server.js";
import { MarketStatePublisher } from "./persistence/market-state-publisher.js";
import {
  collectAssetIds,
  fetchActiveMarkets,
  type ActiveMarket,
} from "./polymarket/markets.js";
import { PolymarketClobWs } from "./polymarket/clob-ws.js";
import { runSentimentPipeline } from "./sentiment/pipeline.js";

const args = process.argv.slice(2);

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
const enableMetrics = args.includes("--metrics");
const kafkaFixture = args.includes("--kafka-fixture") || useFixture;

const divergenceConfig: DivergenceConfig = {
  threshold: env.divergenceThreshold,
  alpha: env.sentimentAlpha,
  minLiquidityUsd: env.minLiquidityUsd,
  minTimeToExpirySec: env.minTimeToExpirySec,
};

function formatTable(alerts: ReturnType<typeof rankAlerts>): string {
  const header = ["DIVERG", "p_mkt", "p_sent", "vol24h", "FLAG", "QUESTION"];
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

async function loadMarkets(count: number): Promise<ActiveMarket[]> {
  if (useFixture) {
    const markets = loadFixtureMarkets(count);
    console.log(`[fixture] using ${markets.length} offline markets`);
    return markets;
  }
  return fetchActiveMarkets(count);
}

async function main() {
  console.log("=== Phronesis Phase 1 — Data Plane ===\n");
  console.log(
    `Markets=${marketCount}  duration=${durationSec}s  refresh=${refreshSec}s  τ=${divergenceConfig.threshold}`,
  );
  console.log(
    `Redis=${env.redisUrl ? "yes" : "no"}  Timescale=${env.databaseUrl ? "yes" : "no"}  FinBERT=${env.finbertEnabled}`,
  );

  if (runX402Demo) {
    await demoX402Call();
  }

  const health = new FeedHealthTracker();
  const publisher = new MarketStatePublisher();
  const metricsServer = enableMetrics ? startMetricsServer(env.phase1MetricsPort) : null;

  console.log(`\nFetching top ${marketCount} active Polymarket markets...`);
  const markets = await loadMarkets(marketCount);
  if (markets.length === 0) throw new Error("No active markets");

  const store = new MarketStateStore(divergenceConfig.alpha);
  store.bootstrap(markets);
  console.log(`Bootstrapped ${store.size()} markets`);

  let sentimentSource: "lexicon" | "finbert" | "hybrid" = "lexicon";
  let kafkaEvents = 0;

  const refreshSentiment = async (): Promise<void> => {
    const { signals, source } = await runSentimentPipeline(markets);
    store.applySentiment(signals);
    sentimentSource = source;
    console.log(`[sentiment] updated ${signals.length} signals (source=${source})`);
  };

  await tryEnrichFromBitquery(env.bitqueryApiKey);
  await refreshSentiment();

  const kafka = await startKafkaConsumer(
    (trade) => {
      if (store.applyBitqueryPrice(trade.conditionId, trade.price, trade.ts)) {
        kafkaEvents += 1;
      }
    },
    { fixture: kafkaFixture },
  );

  const publishState = async (): Promise<void> => {
    const snapshot = store.snapshot();
    const metrics = health.snapshot(store.size(), {
      sentimentSource,
      kafkaEvents: kafka.eventCount(),
    });
    const result = await publisher.publish(snapshot, metrics);
    metrics.redisPublished = result.redis;
    metrics.timescalePublished = result.timescale;
    metrics.kafkaEvents = kafka.eventCount();
    metricsServer?.update(metrics);
  };

  if (sentimentOnly || (useFixture && !args.includes("--live-ws"))) {
    await publishState();
    const snapshot = store.snapshot();
    console.log(formatTable(rankAlerts(snapshot.markets, divergenceConfig, 25)));
    await kafka.stop();
    await publisher.close();
    metricsServer?.close();
    return;
  }

  const assetIds = collectAssetIds(markets, marketCount * 2);
  console.log(`\nSubscribing to ${assetIds.length} outcome tokens via CLOB WS...\n`);

  const ws = new PolymarketClobWs({
    assetIds,
    onTick: (tick) => {
      if (store.applyTick(tick)) {
        health.recordTick(tick.assetId, tick.ts);
      }
    },
    onError: (err) => console.error("[clob-ws]", err.message),
    onReconnect: () => health.recordReconnect(),
    onGapFill: (count) => health.recordGapFill(count),
  });

  ws.connect();

  const printDashboard = () => {
    const snapshot = store.snapshot();
    const alerts = rankAlerts(snapshot.markets, divergenceConfig, 15);
    const tradeable = alerts.filter((a) => a.tradeable).length;

    console.clear();
    console.log(
      `=== Market State v${snapshot.version} | ticks=${health.tickCount} | tradeable=${tradeable} | kafka=${kafka.eventCount()} ===`,
    );
    console.log(formatTable(alerts));
    console.log(`\nUpdated ${new Date(snapshot.ts).toISOString()}  (Ctrl+C to stop)`);
  };

  printDashboard();
  await publishState();

  const refreshTimer = setInterval(() => {
    printDashboard();
    publishState().catch(console.error);
  }, refreshSec * 1000);

  const sentimentTimer = setInterval(
    () => refreshSentiment().catch(console.error),
    sentimentPollSec * 1000,
  );

  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

  clearInterval(refreshTimer);
  clearInterval(sentimentTimer);
  ws.close();
  await kafka.stop();
  await publishState();
  await publisher.close();
  metricsServer?.close();

  const final = store.snapshot();
  console.log(`\n=== Final snapshot (${final.markets.length} markets, ${health.tickCount} ticks) ===`);
  console.log(formatTable(rankAlerts(final.markets, divergenceConfig, 20)));
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
