#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { anchorAuditRecord } from "@phronesis/audit/anchor";
import type { MarketState } from "@phronesis/shared";
import { buildRedactedAuditRecord, summarizeIntents } from "./audit/redacted.js";
import { runPaperBacktest, type BacktestFixture } from "./paper/backtest.js";
import { runCognitiveCycle } from "./pipeline/cognitive.js";
import { loadStrategyConfig } from "./strategy/loader.js";

const args = process.argv.slice(2);
const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const useLlm = args.includes("--llm");
const useFixture = args.includes("--fixture") || !args.includes("--live");
const runBacktest = args.includes("--backtest");
const runPaper = args.includes("--paper");
const anchor = args.includes("--anchor");

function loadSnapshot(): MarketState {
  const path = resolve(pkgRoot, "fixtures/market-snapshot.json");
  return JSON.parse(readFileSync(path, "utf8")) as MarketState;
}

function loadBacktestFixture(): BacktestFixture {
  const path = resolve(pkgRoot, "fixtures/backtest-history.json");
  return JSON.parse(readFileSync(path, "utf8")) as BacktestFixture;
}

async function main() {
  console.log("=== Phronesis Phase 2 — Cognitive Core ===\n");

  const strategy = loadStrategyConfig();

  if (runBacktest) {
    const fixture = loadBacktestFixture();
    const questions: Record<string, string> = {
      "0xfixture001": "Will Bitcoin reach $150k before July 2026?",
      "0xfixture002": "Will the Fed cut rates in March 2026?",
      "0xfixture003": "Will Trump win the 2028 Republican nomination?",
    };

    const report = runPaperBacktest(fixture, strategy, questions);
    console.log("30-day paper backtest report");
    console.log(`  Period:     ${new Date(report.startTs).toISOString()} → ${new Date(report.endTs).toISOString()}`);
    console.log(`  Initial NAV: $${report.initialNav.toFixed(2)}`);
    console.log(`  Final NAV:   $${report.finalNav.toFixed(2)}`);
    console.log(`  Return:      ${(report.totalReturnPct * 100).toFixed(2)}%`);
    console.log(`  Max DD:      ${(report.maxDrawdownPct * 100).toFixed(2)}%`);
    console.log(`  Trades:      ${report.tradeCount} (win rate ${(report.winRate * 100).toFixed(0)}%)`);
    console.log("\nSample trades:");
    for (const t of report.trades.slice(0, 5)) {
      console.log(
        `  ${t.side} ${t.question.slice(0, 40)} | PnL $${t.pnlUsd.toFixed(2)} | ${t.entryPrice.toFixed(3)}→${t.exitPrice.toFixed(3)}`,
      );
    }
    return;
  }

  if (!useFixture) {
    console.warn("[cognitive] --live not implemented yet; use --fixture");
  }

  const snapshot = loadSnapshot();
  console.log(`Loaded snapshot v${snapshot.version} with ${snapshot.markets.length} markets`);
  console.log(`Strategy: NAV=$${strategy.nav} θ=${strategy.kellyTheta} maxPos=${strategy.maxPositionPct}\n`);

  const result = await runCognitiveCycle({
    snapshot,
    strategy,
    useLlm,
    attestationHash: useLlm ? "tee-compute" : "local-rules",
  });

  console.log(`Cycle ${result.cycleId} | LLM=${result.llmUsed} | intents=${result.intents.length}`);
  if (result.rejected.length > 0) {
    console.log(`Rejected: ${result.rejected.length} markets`);
  }

  console.log("\nTrade intents (paper mode):");
  console.log(summarizeIntents(result.intents));

  if (result.opportunities.length > 0) {
    console.log("\nRanked opportunities:");
    for (const o of result.opportunities) {
      console.log(
        `  ${o.side} ${o.question.slice(0, 44)} | $${o.wagerUsd.toFixed(0)} | edge=${o.edge.toFixed(3)} | ${o.thesis.slice(0, 50)}`,
      );
    }
  }

  const auditRecord = buildRedactedAuditRecord(result);
  console.log("\nRedacted audit record:");
  console.log(JSON.stringify(auditRecord, null, 2));

  if (runPaper) {
    console.log("\n[paper] intents logged — execution deferred to Phase 3");
  }

  if (anchor) {
    console.log("\nAnchoring redacted audit to 0G Storage + MemoriaRegistry...");
    const anchored = await anchorAuditRecord(auditRecord);
    console.log(`  Storage: ${anchored.storageRootHash}`);
    console.log(`  Merkle:  ${anchored.merkleRoot}`);
    console.log(`  Anchor:  ${anchored.anchorTxHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
