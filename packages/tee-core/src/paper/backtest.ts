import type { BacktestDay, BacktestReport, PaperPosition, PaperTrade, StrategyConfig } from "@phronesis/shared";
import { rankWithRules } from "../llm/rules-ranker.js";
import { kellyWagerUsd } from "../kelly/sizer.js";
import { blendProbability } from "../probability/blend.js";
import type { MarketEntry } from "@phronesis/shared";

export interface BacktestFixture {
  initialNav: number;
  days: BacktestDay[];
}

export function runPaperBacktest(
  fixture: BacktestFixture,
  strategy: StrategyConfig,
  questions: Record<string, string>,
): BacktestReport {
  let nav = fixture.initialNav;
  let peakNav = nav;
  let maxDrawdownPct = 0;
  const positions: PaperPosition[] = [];
  const trades: PaperTrade[] = [];

  for (let i = 0; i < fixture.days.length; i += 1) {
    const day = fixture.days[i];
    const nextDay = fixture.days[i + 1];

    // Mark to market open positions
    for (const pos of positions) {
      const price = day.prices[pos.conditionId];
      if (price === undefined) continue;
      const mtm = markPosition(pos, price);
      nav = fixture.initialNav + trades.reduce((s, t) => s + t.pnlUsd, 0) + mtm;
    }

    peakNav = Math.max(peakNav, nav);
    const dd = peakNav > 0 ? (peakNav - nav) / peakNav : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, dd);

    // Exit at next day if available
    if (nextDay) {
      for (let p = positions.length - 1; p >= 0; p -= 1) {
        const pos = positions[p];
        const exitPrice = nextDay.prices[pos.conditionId];
        if (exitPrice === undefined) continue;

        const trade = closePosition(pos, exitPrice, nextDay.ts);
        trades.push(trade);
        nav += trade.pnlUsd;
        positions.splice(p, 1);
      }
    }

    // Enter new positions on divergence (every 3 days to simulate rebalance cadence)
    if (i % 3 !== 0) continue;

    const markets: MarketEntry[] = Object.entries(day.prices).map(([conditionId, pMarket]) => {
      const pSentiment = clamp(pMarket + (conditionId === "0xfixture002" ? -0.1 : 0.05), 0.01, 0.99);
      return {
        conditionId,
        question: questions[conditionId] ?? conditionId,
        slug: conditionId,
        yesAssetId: "",
        pMarket,
        pSentiment,
        divergence: pSentiment - pMarket,
        bidAskSpread: 0.02,
        volume24hr: 100_000,
        sentimentScore: 0,
        sentimentConfidence: 0.5,
        sentimentSourceCount: 1,
        expiry: day.ts + 90 * 86_400_000,
        tags: [],
        updatedAt: day.ts,
      };
    });

    const opps = rankWithRules(markets, strategy.divergenceThreshold);
    for (const opp of opps.slice(0, 2)) {
      if (positions.some((p) => p.conditionId === opp.conditionId)) continue;

      const market = markets.find((m) => m.conditionId === opp.conditionId);
      if (!market) continue;

      const pBlended = blendProbability(market.pMarket, opp.pModel, market.pSentiment, strategy);
      const sized = kellyWagerUsd(
        opp.side === "BUY_YES" ? pBlended : 1 - pBlended,
        market.pMarket,
        strategy.kellyTheta,
        nav,
        strategy.maxPositionPct,
        strategy.minBetUsd,
      );

      if (sized.wagerUsd <= 0) continue;

      positions.push({
        conditionId: opp.conditionId,
        question: market.question,
        side: opp.side === "BUY_YES" ? "YES" : "NO",
        entryPrice: market.pMarket,
        sizeUsd: sized.wagerUsd,
        entryTs: day.ts,
      });
    }
  }

  // Close remaining
  const lastDay = fixture.days[fixture.days.length - 1];
  for (const pos of positions) {
    const exitPrice = lastDay.prices[pos.conditionId] ?? pos.entryPrice;
    trades.push(closePosition(pos, exitPrice, lastDay.ts));
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);
  const finalNav = fixture.initialNav + totalPnl;
  const wins = trades.filter((t) => t.pnlUsd > 0).length;

  return {
    startTs: fixture.days[0]?.ts ?? 0,
    endTs: lastDay?.ts ?? 0,
    initialNav: fixture.initialNav,
    finalNav,
    totalReturnPct: fixture.initialNav > 0 ? (finalNav - fixture.initialNav) / fixture.initialNav : 0,
    maxDrawdownPct,
    tradeCount: trades.length,
    winRate: trades.length > 0 ? wins / trades.length : 0,
    trades,
  };
}

function markPosition(pos: PaperPosition, yesPrice: number): number {
  const current = pos.side === "YES" ? yesPrice : 1 - yesPrice;
  const entry = pos.side === "YES" ? pos.entryPrice : 1 - pos.entryPrice;
  const ret = entry > 0 ? (current - entry) / entry : 0;
  return pos.sizeUsd * ret;
}

function closePosition(pos: PaperPosition, yesPrice: number, exitTs: number): PaperTrade {
  const exitPrice = pos.side === "YES" ? yesPrice : 1 - yesPrice;
  const entry = pos.side === "YES" ? pos.entryPrice : 1 - pos.entryPrice;
  const ret = entry > 0 ? (exitPrice - entry) / entry : 0;

  return {
    conditionId: pos.conditionId,
    question: pos.question,
    side: pos.side,
    entryPrice: entry,
    exitPrice,
    sizeUsd: pos.sizeUsd,
    pnlUsd: pos.sizeUsd * ret,
    entryTs: pos.entryTs,
    exitTs,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
