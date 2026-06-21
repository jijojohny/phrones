import type { EncryptedMarketStateBundle, MarketState } from "@phronesis/shared";
import { env } from "@phronesis/shared";

export interface RedisPublisher {
  publish(state: MarketState): Promise<void>;
  publishEncrypted(bundle: EncryptedMarketStateBundle): Promise<void>;
  close(): Promise<void>;
}

export async function createRedisPublisher(): Promise<RedisPublisher | null> {
  if (!env.redisUrl) return null;

  const { createClient } = await import("redis");
  const client = createClient({ url: env.redisUrl });
  client.on("error", (err) => console.warn("[redis]", err.message));
  await client.connect();
  console.log("[redis] connected");

  return {
    async publish(state: MarketState) {
      await client.set("phronesis:market-state:latest", JSON.stringify(state), { EX: 3600 });
      await client.set("phronesis:market-state:version", String(state.version));
      await client.publish("phronesis:market-state", JSON.stringify({ version: state.version, ts: state.ts }));
    },
    async publishEncrypted(bundle: EncryptedMarketStateBundle) {
      await client.set("phronesis:market-state:encrypted", JSON.stringify(bundle), { EX: 3600 });
    },
    async close() {
      await client.quit();
    },
  };
}
