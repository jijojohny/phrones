import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BitqueryTrade } from "./graphql.js";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

export interface KafkaTradeHandler {
  (trade: BitqueryTrade): void;
}

export interface KafkaConsumerHandle {
  stop(): Promise<void>;
  eventCount(): number;
}

/** Bitquery Kafka consumer — live when BITQUERY_KAFKA_BROKERS set, else fixture replay. */
export async function startKafkaConsumer(
  onTrade: KafkaTradeHandler,
  opts: { fixture?: boolean } = {},
): Promise<KafkaConsumerHandle> {
  const { env } = await import("@phronesis/shared");
  let eventCount = 0;
  let stopped = false;

  if (env.bitqueryKafkaBrokers && !opts.fixture) {
    return startLiveKafka(env.bitqueryKafkaBrokers, env.bitqueryKafkaTopic, env.bitqueryKafkaGroup, onTrade);
  }

  const trades = loadFixtureTrades();
  console.log(`[kafka] fixture mode — replaying ${trades.length} trades`);

  const interval = setInterval(() => {
    if (stopped) return;
    const trade = trades[eventCount % trades.length];
    if (trade) {
      onTrade(trade);
      eventCount += 1;
    }
  }, 3_000);

  return {
    async stop() {
      stopped = true;
      clearInterval(interval);
    },
    eventCount: () => eventCount,
  };
}

async function startLiveKafka(
  brokers: string,
  topic: string,
  groupId: string,
  onTrade: KafkaTradeHandler,
): Promise<KafkaConsumerHandle> {
  const { Kafka } = await import("kafkajs");
  let eventCount = 0;

  const kafka = new Kafka({
    clientId: "phronesis-ingestion",
    brokers: brokers.split(",").map((b) => b.trim()),
  });

  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`[kafka] subscribed to ${topic}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const raw = JSON.parse(message.value.toString()) as Record<string, unknown>;
        const trade = parseKafkaMessage(raw);
        if (trade) {
          onTrade(trade);
          eventCount += 1;
        }
      } catch {
        // skip malformed
      }
    },
  });

  return {
    async stop() {
      await consumer.disconnect();
    },
    eventCount: () => eventCount,
  };
}

function parseKafkaMessage(raw: Record<string, unknown>): BitqueryTrade | null {
  const conditionId = String(raw.conditionId ?? raw.condition_id ?? raw.market ?? "");
  const price = Number(raw.price ?? raw.Price ?? 0);
  if (!conditionId || price <= 0) return null;
  return {
    conditionId,
    price,
    amount: Number(raw.amount ?? raw.Amount ?? 0),
    side: String(raw.side ?? raw.Side ?? ""),
    ts: Number(raw.ts ?? raw.timestamp ?? Date.now()),
  };
}

function loadFixtureTrades(): BitqueryTrade[] {
  const path = resolve(pkgRoot, "fixtures/bitquery-trades.json");
  return JSON.parse(readFileSync(path, "utf8")) as BitqueryTrade[];
}

export async function backfillFromGraphql(
  apiKey: string,
  limit: number,
): Promise<BitqueryTrade[]> {
  const { fetchRecentPolymarketTrades } = await import("./graphql.js");
  return fetchRecentPolymarketTrades(apiKey, limit);
}
