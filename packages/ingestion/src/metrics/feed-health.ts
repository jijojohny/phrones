import type { FeedHealthMetrics } from "@phronesis/shared";

export class FeedHealthTracker {
  tickCount = 0;
  missedTicks = 0;
  reconnects = 0;
  gapFills = 0;
  private lagSamples: number[] = [];
  private lastTickByAsset = new Map<string, number>();
  private readonly staleMs: number;

  constructor(staleMs = 5_000) {
    this.staleMs = staleMs;
  }

  recordTick(assetId: string, ts: number): void {
    this.tickCount += 1;
    const lag = Math.max(0, Date.now() - ts);
    this.lagSamples.push(lag);
    if (this.lagSamples.length > 500) this.lagSamples.shift();
    this.lastTickByAsset.set(assetId, ts);
  }

  recordReconnect(): void {
    this.reconnects += 1;
  }

  recordGapFill(count: number): void {
    this.gapFills += count;
  }

  checkMissed(): void {
    const now = Date.now();
    for (const [, lastTs] of this.lastTickByAsset) {
      if (now - lastTs > this.staleMs) this.missedTicks += 1;
    }
  }

  snapshot(
    marketCount: number,
    extras: Partial<FeedHealthMetrics> = {},
  ): FeedHealthMetrics {
    this.checkMissed();
    const avgLagMs =
      this.lagSamples.length > 0
        ? this.lagSamples.reduce((a, b) => a + b, 0) / this.lagSamples.length
        : 0;
    const maxLagMs = this.lagSamples.length > 0 ? Math.max(...this.lagSamples) : 0;

    return {
      ts: Date.now(),
      marketCount,
      tickCount: this.tickCount,
      missedTicks: this.missedTicks,
      reconnects: this.reconnects,
      gapFills: this.gapFills,
      avgLagMs,
      maxLagMs,
      sentimentSource: "lexicon",
      redisPublished: false,
      timescalePublished: false,
      kafkaEvents: 0,
      ...extras,
    };
  }
}

export function formatPrometheus(metrics: FeedHealthMetrics): string {
  const lines = [
    "# HELP phronesis_feed_tick_count Total CLOB ticks received",
    "# TYPE phronesis_feed_tick_count counter",
    `phronesis_feed_tick_count ${metrics.tickCount}`,
    "# HELP phronesis_feed_missed_ticks Stale/missed tick detections",
    "# TYPE phronesis_feed_missed_ticks counter",
    `phronesis_feed_missed_ticks ${metrics.missedTicks}`,
    "# HELP phronesis_feed_reconnects WebSocket reconnect count",
    "# TYPE phronesis_feed_reconnects counter",
    `phronesis_feed_reconnects ${metrics.reconnects}`,
    "# HELP phronesis_feed_gap_fills Gap-fill REST backfills",
    "# TYPE phronesis_feed_gap_fills counter",
    `phronesis_feed_gap_fills ${metrics.gapFills}`,
    "# HELP phronesis_feed_avg_lag_ms Average tick lag milliseconds",
    "# TYPE phronesis_feed_avg_lag_ms gauge",
    `phronesis_feed_avg_lag_ms ${metrics.avgLagMs.toFixed(2)}`,
    "# HELP phronesis_feed_market_count Active markets in snapshot",
    "# TYPE phronesis_feed_market_count gauge",
    `phronesis_feed_market_count ${metrics.marketCount}`,
    "# HELP phronesis_feed_kafka_events Bitquery Kafka events processed",
    "# TYPE phronesis_feed_kafka_events counter",
    `phronesis_feed_kafka_events ${metrics.kafkaEvents}`,
  ];
  return lines.join("\n") + "\n";
}
