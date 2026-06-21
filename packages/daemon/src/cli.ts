#!/usr/bin/env node
import { env } from "@phronesis/shared";
import { runFundCycle } from "./cycle.js";

function parseArgs(argv: string[]) {
  const args = argv.filter((a) => a !== "--");
  return {
    once: args.includes("--once"),
    live: args.includes("--live"),
    fixture: args.includes("--fixture") || !args.includes("--live"),
    llm: args.includes("--llm"),
    crossChain: args.includes("--cross-chain"),
    anchor: args.includes("--anchor"),
    trackFills: args.includes("--track-fills"),
    intervalSec: Number(args.find((a) => a.startsWith("--interval="))?.split("=")[1] ?? env.daemonCycleSec),
  };
}

async function runOnce(opts: ReturnType<typeof parseArgs>) {
  console.log("=== Phronesis Fund Daemon ===\n");
  console.log(`Mode: ${opts.live ? "live" : "dry-run"} | fixture: ${opts.fixture}`);
  console.log(`Cross-chain: ${opts.crossChain} | anchor: ${opts.anchor}\n`);

  const result = await runFundCycle({
    mode: opts.live ? "live" : "dry-run",
    fixture: opts.fixture,
    llm: opts.llm,
    crossChain: opts.crossChain,
    anchor: opts.anchor,
    trackFills: opts.trackFills,
  });

  console.log(result.relayReport);
  console.log("\nFills:");
  console.log(result.fillsSummary);

  if (result.anchored) {
    console.log(`\nAudit anchored: ${result.anchored.merkleRoot}`);
    if (result.anchored.anchorTxHash) {
      console.log(`  tx: ${result.anchored.anchorTxHash}`);
    }
  }

  console.log(`\nCycle ${result.cycle.cycleId} complete | intents=${result.cycle.intents.length}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.once) {
    await runOnce(opts);
    return;
  }

  console.log(`[daemon] Starting loop every ${opts.intervalSec}s (Ctrl+C to stop)`);
  for (;;) {
    try {
      await runOnce(opts);
    } catch (err) {
      console.error("[daemon] cycle error:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, opts.intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
