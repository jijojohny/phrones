import type { FeedHealthMetrics, MarketState } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { encryptMarketState } from "./encrypt-state.js";
import { createRedisPublisher, type RedisPublisher } from "./redis-publisher.js";
import { createTimescaleWriter, type TimescaleWriter } from "./timescale-writer.js";

export interface PublishResult {
  redis: boolean;
  timescale: boolean;
  encryptedRedis: boolean;
}

export class MarketStatePublisher {
  private redis: RedisPublisher | null = null;
  private timescale: TimescaleWriter | null = null;
  private ready = false;

  async init(): Promise<void> {
    if (this.ready) return;
    this.redis = await createRedisPublisher();
    this.timescale = await createTimescaleWriter();
    this.ready = true;
  }

  async publish(state: MarketState, metrics?: FeedHealthMetrics): Promise<PublishResult> {
    await this.init();
    const result: PublishResult = { redis: false, timescale: false, encryptedRedis: false };

    if (this.redis) {
      await this.redis.publish(state);
      result.redis = true;

      const key = env.marketStateEncryptionKey || env.fundEncryptionKey;
      if (key) {
        const bundle = encryptMarketState(state, key);
        await this.redis.publishEncrypted(bundle);
        result.encryptedRedis = true;
      }
    }

    if (this.timescale) {
      await this.timescale.writeSnapshot(state);
      if (metrics) await this.timescale.writeMetrics(metrics);
      result.timescale = true;
    }

    return result;
  }

  async close(): Promise<void> {
    await this.redis?.close();
    await this.timescale?.close();
  }
}
