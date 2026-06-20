import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCognitiveCycle } from "@phronesis/tee-core/pipeline";
import { loadStrategyConfig } from "@phronesis/tee-core/strategy";
import type { CrossChainIntent, MarketState } from "@phronesis/shared";
import { tradeIntentToCrossChain } from "./eip712.js";
import {
  formatRelayResult,
  relayCrossChainIntents,
  fetchRelayerStatus,
} from "./cross-chain-relayer.js";

function parseArgs(argv: string[]): { mode: "dry-run" | "live"; fixture: boolean } {
  const args = argv.filter((a) => a !== "--");
  const mode = args.includes("--live") ? "live" : "dry-run";
  const fixture = args.includes("--fixture") || !args.includes("--live");
  return { mode, fixture };
}

function loadSnapshot(): MarketState {
  const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
  const path = resolve(pkgRoot, "../tee-core/fixtures/market-snapshot.json");
  return JSON.parse(readFileSync(path, "utf8")) as MarketState;
}

async function main(): Promise<void> {
  const { mode, fixture } = parseArgs(process.argv.slice(2));

  console.log(`[relayer] Cross-chain relay (${mode})`);

  const status = await fetchRelayerStatus();
  console.log(`Bridge: ${status.bridgeAddress || "(not deployed)"}`);
  console.log(`Intents on-chain: ${status.pending}`);

  if (!fixture) {
    console.warn("[relayer] Live snapshot not wired; use --fixture");
  }

  const strategy = loadStrategyConfig();
  const snapshot = loadSnapshot();
  const cycle = await runCognitiveCycle({
    snapshot,
    strategy,
    useLlm: false,
    attestationHash: "relayer-local",
  });

  const crossChain: CrossChainIntent[] = cycle.intents
    .filter((i) => i.chainId === 137)
    .map((i) => tradeIntentToCrossChain(i, cycle.cycleId));

  if (crossChain.length === 0) {
    console.log("No Polygon-bound intents in this cycle.");
    return;
  }

  console.log(`Relaying ${crossChain.length} intent(s)...`);
  const results = await relayCrossChainIntents(crossChain, { mode });

  for (const r of results) {
    console.log(formatRelayResult(r));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
