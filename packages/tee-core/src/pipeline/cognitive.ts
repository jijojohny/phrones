import { createHash } from "node:crypto";
import type {
  CognitiveCycleResult,
  MarketEntry,
  MarketState,
  Opportunity,
  RankedOpportunity,
  StrategyConfig,
  TradeIntent,
} from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { allocateMultiMarket } from "../allocator/multi-market.js";
import {
  attestationHashFromQuote,
  fetchAttestationQuote,
  verifyAttestationQuote,
} from "../attestation/verify.js";
import { normalizeSnapshot } from "../ingest/decrypt-snapshot.js";
import { rankWithComputeLlm } from "../llm/compute-client.js";
import { rankWithRules } from "../llm/rules-ranker.js";
import { fractionalKellyNo, kellyWagerUsd } from "../kelly/sizer.js";
import { blendProbability } from "../probability/blend.js";
import {
  checkCircuitBreaker,
  checkCorrelationGuard,
  checkDrawdownGuard,
  checkMarketGuards,
} from "../risk/guards.js";
import { signTradeIntents } from "../signing/eip712-intent.js";

const POLYMARKET_CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as const;

export interface RunCognitiveCycleOptions {
  snapshot: MarketState;
  strategy: StrategyConfig;
  useLlm?: boolean;
  peakNav?: number;
  attestationHash?: string;
  signIntents?: boolean;
  openBook?: MarketEntry[];
  strictFreshness?: boolean;
}

export async function runCognitiveCycle(
  opts: RunCognitiveCycleOptions,
): Promise<CognitiveCycleResult> {
  const { strategy, peakNav = strategy.nav } = opts;
  const snapshot = normalizeSnapshot(opts.snapshot, opts.strictFreshness);
  const cycleId = `cycle-${snapshot.ts}`;
  const rejected: CognitiveCycleResult["rejected"] = [];
  const marketById = new Map(snapshot.markets.map((m) => [m.conditionId, m]));
  const openBook = opts.openBook ?? [];

  let attestationHash = opts.attestationHash ?? `local-${cycleId}`;
  if (opts.useLlm) {
    const quote = await fetchAttestationQuote();
    const attestationOk = verifyAttestationQuote(quote);
    const breaker = checkCircuitBreaker(snapshot.ts, attestationOk, env.maxSnapshotStaleMs);
    if (!breaker.ok) {
      return emptyCycle(cycleId, strategy.nav, false, breaker.reason ?? "circuit breaker");
    }
    attestationHash = attestationHashFromQuote(quote);
  }

  const dd = checkDrawdownGuard(peakNav, strategy.nav, strategy.maxDrawdownPct);
  if (!dd.ok) {
    return emptyCycle(cycleId, strategy.nav, false, dd.reason ?? "drawdown halt");
  }

  const eligible = snapshot.markets.filter((m) => {
    const g = checkMarketGuards(m, strategy, snapshot.ts);
    if (!g.ok) {
      rejected.push({ conditionId: m.conditionId, reason: g.reason ?? "rejected" });
      return false;
    }

    const corr = checkCorrelationGuard(m, openBook, env.maxCorrelation);
    if (!corr.ok) {
      rejected.push({ conditionId: m.conditionId, reason: corr.reason ?? "correlated" });
      return false;
    }

    return true;
  });

  let opportunities: Opportunity[] = [];
  let llmUsed = false;

  if (opts.useLlm) {
    try {
      const llm = await rankWithComputeLlm(eligible, strategy);
      opportunities = llm.opportunities;
      llmUsed = true;
    } catch (err) {
      console.warn(
        "[cognitive] LLM failed, falling back to rules:",
        err instanceof Error ? err.message : err,
      );
      opportunities = rankWithRules(eligible, strategy.divergenceThreshold);
    }
  } else {
    opportunities = rankWithRules(eligible, strategy.divergenceThreshold);
  }

  for (const opp of opportunities) {
    const market = marketById.get(opp.conditionId);
    if (market && !opp.question) opp.question = market.question;
  }

  const ranked = opportunities
    .map((opp) => sizeOpportunity(opp, marketById.get(opp.conditionId), strategy))
    .filter((o): o is RankedOpportunity => o !== null);

  const allocated = allocateMultiMarket(ranked, strategy);

  let intents: TradeIntent[] = allocated.map((opp) =>
    toTradeIntent(opp, strategy, attestationHash, snapshot.ts),
  );

  const shouldSign = opts.signIntents ?? Boolean(env.teeSignerPrivateKey || env.sessionKeyPrivateKey);
  const signerKey = env.teeSignerPrivateKey || env.sessionKeyPrivateKey;
  if (shouldSign && signerKey) {
    intents = await signTradeIntents(intents, signerKey);
  }

  return {
    cycleId,
    ts: snapshot.ts,
    nav: strategy.nav,
    opportunities: allocated,
    intents,
    rejected,
    llmUsed,
  };
}

function sizeOpportunity(
  opp: Opportunity,
  market: MarketEntry | undefined,
  strategy: StrategyConfig,
): RankedOpportunity | null {
  if (!market || opp.side === "HOLD") return null;

  const pSentiment = market.pSentiment;
  const pBlended = blendProbability(market.pMarket, opp.pModel, pSentiment, {
    wMarket: strategy.wMarket,
    wModel: strategy.wModel,
    wSentiment: strategy.wSentiment,
  });

  const price = opp.side === "BUY_YES" ? (market.ask ?? market.pMarket) : 1 - (market.bid ?? market.pMarket);
  const pWin = opp.side === "BUY_YES" ? pBlended : 1 - pBlended;

  const sized =
    opp.side === "BUY_YES"
      ? kellyWagerUsd(
          pWin,
          price,
          strategy.kellyTheta,
          strategy.nav,
          strategy.maxPositionPct,
          strategy.minBetUsd,
        )
      : (() => {
          const f = fractionalKellyNo(pBlended, market.pMarket, strategy.kellyTheta);
          const fraction = Math.min(f, strategy.maxPositionPct);
          const wagerUsd = fraction * strategy.nav;
          const edge = (1 - pBlended) * (1 / (1 - market.pMarket)) - pBlended;
          return {
            fraction: wagerUsd >= strategy.minBetUsd ? fraction : 0,
            wagerUsd: wagerUsd >= strategy.minBetUsd ? wagerUsd : 0,
            edge,
          };
        })();

  if (sized.wagerUsd <= 0) return null;

  return {
    ...opp,
    pBlended,
    kellyFraction: sized.fraction,
    wagerUsd: sized.wagerUsd,
    edge: sized.edge,
  };
}

function toTradeIntent(
  opp: RankedOpportunity,
  strategy: StrategyConfig,
  attestationHash: string,
  ts: number,
): TradeIntent {
  const outcome = opp.side === "BUY_YES" ? "YES" : "NO";
  return {
    chainId: 137,
    target: POLYMARKET_CTF_EXCHANGE,
    calldata: "0x" as `0x${string}`,
    value: 0n,
    marketRef: opp.conditionId,
    question: opp.question,
    side: "BUY",
    outcome,
    sizeUsd: opp.wagerUsd,
    maxSlippage: 0.02,
    kellyFraction: opp.kellyFraction,
    pBlended: opp.pBlended,
    attestationHash,
    ts,
  };
}

function emptyCycle(
  cycleId: string,
  nav: number,
  llmUsed: boolean,
  reason: string,
): CognitiveCycleResult {
  return {
    cycleId,
    ts: Date.now(),
    nav,
    opportunities: [],
    intents: [],
    rejected: [{ conditionId: "*", reason }],
    llmUsed,
  };
}

export function hashIntents(intents: TradeIntent[]): string {
  const payload = JSON.stringify(
    intents.map((i) => ({
      marketRef: i.marketRef,
      side: i.side,
      outcome: i.outcome,
      sizeUsd: i.sizeUsd,
      kellyFraction: i.kellyFraction,
      signature: i.signature,
    })),
  );
  return createHash("sha256").update(payload).digest("hex");
}
