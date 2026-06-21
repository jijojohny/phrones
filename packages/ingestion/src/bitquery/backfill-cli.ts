#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@phronesis/shared";
import { backfillFromGraphql } from "./kafka-consumer.js";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "100");
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];

async function main(): Promise<void> {
  if (!env.bitqueryApiKey) {
    console.error("BITQUERY_API_KEY required for GraphQL backfill");
    process.exit(1);
  }

  console.log(`[backfill] fetching ${limit} trades from Bitquery GraphQL...`);
  const trades = await backfillFromGraphql(env.bitqueryApiKey, limit);
  console.log(`[backfill] got ${trades.length} trades`);

  const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
  const outPath = outArg ?? resolve(pkgRoot, "fixtures/bitquery-trades.json");
  writeFileSync(outPath, JSON.stringify(trades, null, 2));
  console.log(`[backfill] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
