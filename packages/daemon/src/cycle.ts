import { anchorAuditRecord } from "@phronesis/audit/anchor";
import { formatRelayReport, relayIntents } from "@phronesis/execution/relayer/pipeline";
import { trackFills, summarizeFills } from "@phronesis/execution/polymarket/fill-tracker";
import { buildMarketSnapshot, topTradeableCount } from "@phronesis/ingestion/snapshot";
import { relayCrossChainIntents } from "@phronesis/relayer/cross-chain-relayer";
import { tradeIntentToCrossChain } from "@phronesis/relayer/eip712";
import { env } from "@phronesis/shared";
import type { CognitiveCycleResult } from "@phronesis/shared";
import { buildRedactedAuditRecord } from "@phronesis/tee-core/audit";
import { runCognitiveCycle } from "@phronesis/tee-core/pipeline";
import { loadStrategyConfig } from "@phronesis/tee-core/strategy";
import { shouldRebalance } from "./rebalance.js";

export interface FundCycleOptions {
  mode: "dry-run" | "live";
  fixture?: boolean;
  llm?: boolean;
  crossChain?: boolean;
  anchor?: boolean;
  trackFills?: boolean;
  marketCount?: number;
}

export interface FundCycleResult {
  cycle: CognitiveCycleResult;
  tradeable: number;
  relayReport: string;
  fillsSummary: string;
  crossChainCount: number;
  anchored?: { merkleRoot: string; anchorTxHash?: string };
  rebalanced: boolean;
}

export async function runFundCycle(opts: FundCycleOptions): Promise<FundCycleResult> {
  const strategy = loadStrategyConfig();

  console.log("[daemon] Building market snapshot...");
  const snapshot = await buildMarketSnapshot({
    fixture: opts.fixture,
    marketCount: opts.marketCount ?? 50,
    wsCollectSec: opts.fixture ? 0 : 15,
  });

  const tradeable = topTradeableCount(snapshot);
  console.log(`[daemon] Snapshot v${snapshot.version} | ${snapshot.markets.length} markets | ${tradeable} tradeable`);

  const rebalanced = shouldRebalance(snapshot, strategy);
  if (!rebalanced && tradeable === 0) {
    console.log("[daemon] No rebalance trigger and no tradeable markets — skipping execution");
  }

  console.log("[daemon] Running cognitive cycle...");
  const cycle = await runCognitiveCycle({
    snapshot,
    strategy,
    useLlm: opts.llm,
    attestationHash: opts.llm ? "tee-compute" : "daemon-local",
  });

  const relayResult = await relayIntents(cycle, { mode: opts.mode });
  const fills = await trackFills(relayResult.execution, {
    mode: opts.mode,
    poll: opts.trackFills,
  });

  let crossChainCount = 0;
  if (opts.crossChain && cycle.intents.some((i) => i.chainId === 137)) {
    const cross = cycle.intents
      .filter((i) => i.chainId === 137)
      .map((i) => tradeIntentToCrossChain(i, cycle.cycleId));
    const relayed = await relayCrossChainIntents(cross, { mode: opts.mode });
    crossChainCount = relayed.filter((r) => r.submitted).length;
    console.log(`[daemon] Cross-chain relay: ${crossChainCount}/${cross.length} submitted`);
  }

  let anchored: FundCycleResult["anchored"];
  if (opts.anchor) {
    const record = {
      ...buildRedactedAuditRecord(cycle),
      executionMode: relayResult.execution.mode,
      ordersSubmitted: relayResult.execution.submitted,
      fillCount: fills.length,
    };
    console.log("[daemon] Anchoring audit record...");
    const result = await anchorAuditRecord(record);
    anchored = { merkleRoot: result.merkleRoot, anchorTxHash: result.anchorTxHash };
  }

  return {
    cycle,
    tradeable,
    relayReport: await formatRelayReport(relayResult, { trackFills: opts.trackFills }),
    fillsSummary: summarizeFills(fills),
    crossChainCount,
    anchored,
    rebalanced,
  };
}
