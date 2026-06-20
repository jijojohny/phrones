#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectAssetIds, fetchActiveMarkets } from "./polymarket/markets.js";
import { PolymarketClobWsFailover } from "./polymarket/clob-ws-failover.js";

const args = process.argv.slice(2);
const durationSec = Number(args.find((a) => a.startsWith("--duration="))?.split("=")[1] ?? 20);
const useFixture = args.includes("--fixture");

async function main() {
  console.log("=== Phase 5 HA ingestion smoke test ===\n");

  let assetIds: string[];
  if (useFixture) {
    const fixturePath = resolve(
      fileURLToPath(new URL(".", import.meta.url)),
      "../fixtures/sample-markets.json",
    );
    const markets = JSON.parse(readFileSync(fixturePath, "utf8")) as Array<{ tokenIds: string[] }>;
    assetIds = markets.flatMap((m) => m.tokenIds);
    console.log(`[fixture] ${assetIds.length} asset ids`);
  } else {
    const markets = await fetchActiveMarkets(10);
    assetIds = collectAssetIds(markets, 20);
    console.log(`Fetched ${markets.length} markets, ${assetIds.length} assets`);
  }

  let ticks = 0;
  const ws = new PolymarketClobWsFailover({
    assetIds,
    onTick: () => {
      ticks += 1;
    },
    onError: (e) => console.error("[ha]", e.message),
    failoverAfterDisconnects: 1,
  });

  ws.connect();
  await new Promise((r) => setTimeout(r, durationSec * 1000));
  ws.close();

  const stats = ws.stats();
  console.log(`\nTicks (active feed): ${ticks}`);
  console.log(`Active feed: ${stats.activeFeed}`);
  console.log(`Primary ticks: ${stats.primaryTicks} | Secondary: ${stats.secondaryTicks}`);
  console.log(`Failovers: ${stats.failovers}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
