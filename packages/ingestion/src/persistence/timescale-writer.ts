import type { FeedHealthMetrics, MarketEntry, MarketState } from "@phronesis/shared";
import { env } from "@phronesis/shared";

export interface TimescaleWriter {
  writeSnapshot(state: MarketState): Promise<void>;
  writeMetrics(metrics: FeedHealthMetrics): Promise<void>;
  close(): Promise<void>;
}

export async function createTimescaleWriter(): Promise<TimescaleWriter | null> {
  if (!env.databaseUrl) return null;

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: env.databaseUrl });

  try {
    await pool.query("SELECT 1");
    console.log("[timescale] connected");
  } catch (err) {
    console.warn("[timescale] connection failed:", err instanceof Error ? err.message : err);
    await pool.end();
    return null;
  }

  return {
    async writeSnapshot(state: MarketState) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO market_snapshots (ts, version, market_count) VALUES ($1, $2, $3)`,
          [new Date(state.ts), state.version, state.markets.length],
        );

        for (const m of state.markets) {
          await client.query(
            `INSERT INTO market_ticks
              (ts, condition_id, question, p_market, p_sentiment, divergence, volume_24hr, bid_ask_spread)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              new Date(m.updatedAt),
              m.conditionId,
              m.question,
              m.pMarket,
              m.pSentiment,
              m.divergence,
              m.volume24hr,
              m.bidAskSpread,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async writeMetrics(metrics: FeedHealthMetrics) {
      await pool.query(
        `INSERT INTO feed_health
          (ts, market_count, tick_count, missed_ticks, reconnects, gap_fills, avg_lag_ms, max_lag_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          new Date(metrics.ts),
          metrics.marketCount,
          metrics.tickCount,
          metrics.missedTicks,
          metrics.reconnects,
          metrics.gapFills,
          metrics.avgLagMs,
          metrics.maxLagMs,
        ],
      );
    },

    async close() {
      await pool.end();
    },
  };
}

export async function applyBitqueryTradesToStore(
  trades: Array<{ conditionId: string; price: number; ts: number }>,
  apply: (conditionId: string, price: number, ts: number) => void,
): Promise<number> {
  let applied = 0;
  for (const t of trades) {
    if (!t.conditionId || t.price <= 0) continue;
    apply(t.conditionId, t.price, t.ts);
    applied += 1;
  }
  return applied;
}

export type { MarketEntry };
