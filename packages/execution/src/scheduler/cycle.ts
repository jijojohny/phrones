#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@phronesis/shared";
import type { MarketState } from "@phronesis/shared";
import { runCognitiveCycle } from "@phronesis/tee-core/pipeline";
import { loadStrategyConfig } from "@phronesis/tee-core/strategy";
import { signTradeIntents } from "@phronesis/tee-core/signing";
import { relayIntents, formatRelayReport } from "../relayer/pipeline.js";
import { defaultSchedulerConfig, printSchedulerStatus, sleep } from "./config.js";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const teeRoot = resolve(pkgRoot, "../tee-core");

function loadSnapshot(): MarketState {
  const path = resolve(teeRoot, "fixtures/market-snapshot.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as MarketState;
  const ts = Date.now();
  return {
    ...raw,
    ts,
    markets: raw.markets.map((m) => ({ ...m, updatedAt: ts })),
  };
}

async function runCycle(mode: "dry-run" | "live", trackFills: boolean): Promise<void> {
  const snapshot = loadSnapshot();
  const strategy = loadStrategyConfig();
  const cycle = await runCognitiveCycle({
    snapshot,
    strategy,
    attestationHash: "scheduler-local",
  });

  let intents = cycle.intents;
  if (env.teeSignerPrivateKey || env.sessionKeyPrivateKey) {
    const key = env.teeSignerPrivateKey || env.sessionKeyPrivateKey!;
    intents = await signTradeIntents(intents, key);
  }

  const signedCycle = { ...cycle, intents };
  const result = await relayIntents(signedCycle, { mode, trackFills });
  console.log(await formatRelayReport(result, { trackFills }));
}

async function main(): Promise<void> {
  const cfg = defaultSchedulerConfig();
  const once = process.argv.includes("--once");

  console.log("=== Phronesis Phase 3 — Execution Scheduler ===");
  printSchedulerStatus();
  console.log(`Interval: ${cfg.intervalSec}s | Mode: ${cfg.mode}\n`);

  do {
    console.log(`[scheduler] cycle @ ${new Date().toISOString()}`);
    await runCycle(cfg.mode, cfg.trackFills);
    if (once) break;
    await sleep(cfg.intervalSec * 1000);
  } while (true);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
