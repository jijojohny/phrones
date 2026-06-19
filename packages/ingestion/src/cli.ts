#!/usr/bin/env node
import { collectAssetIds, fetchTopMarkets } from "./polymarket/markets.js";
import { PolymarketClobWs } from "./polymarket/clob-ws.js";

const args = process.argv.slice(2);
const marketsOnly = args.includes("--markets-only");
const durationSec = Number(args.find((a) => a.startsWith("--duration="))?.split("=")[1] ?? 30);
const marketCount = Number(args.find((a) => a.startsWith("--markets="))?.split("=")[1] ?? 10);

async function main() {
  console.log(`Fetching top ${marketCount} Polymarket markets...`);
  const markets = await fetchTopMarkets(marketCount);

  if (markets.length === 0) {
    throw new Error("No active markets returned from Gamma API");
  }

  for (const m of markets) {
    const yesPrice = m.prices[0];
    console.log(`- ${m.question.slice(0, 72)} | p≈${yesPrice?.toFixed(3) ?? "?"}`);
  }

  if (marketsOnly) return;

  const assetIds = collectAssetIds(markets, 50);
  console.log(`\nStreaming ${assetIds.length} outcome tokens for ${durationSec}s...\n`);

  let tickCount = 0;
  const ws = new PolymarketClobWs({
    assetIds,
    onTick: (tick) => {
      tickCount += 1;
      const p = tick.pImplied ?? tick.mid ?? tick.lastTrade;
      if (p === undefined) return;
      console.log(
        `[${tick.eventType}] asset=${tick.assetId.slice(0, 12)}… p=${p.toFixed(4)}`,
      );
    },
    onError: (err) => console.error("[clob-ws] error:", err.message),
  });

  ws.connect();

  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
  ws.close();
  console.log(`\nDone. Received ${tickCount} ticks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
