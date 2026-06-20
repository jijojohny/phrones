const BITQUERY_URL = "https://streaming.bitquery.io/graphql";

export interface BitqueryTrade {
  conditionId: string;
  price: number;
  amount: number;
  side: string;
  ts: number;
}

interface GraphqlResponse {
  data?: {
    EVM?: {
      DEXTrades?: Array<{
        Block?: { Time?: string };
        Trade?: { Price?: number; Amount?: number; Side?: string };
        Market?: { ConditionId?: string };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

/** Optional Bitquery enrichment — skipped when BITQUERY_API_KEY is unset. */
export async function fetchRecentPolymarketTrades(
  apiKey: string,
  limit = 50,
): Promise<BitqueryTrade[]> {
  const query = `
    query RecentPolymarketTrades($limit: Int!) {
      EVM(network: matic, dataset: combined) {
        DEXTrades(
          limit: { count: $limit }
          orderBy: { descending: Block_Time }
          where: {
            Trade: { Dex: { ProtocolName: { is: "polymarket" } } }
          }
        ) {
          Block { Time }
          Trade { Price Amount Side }
          Transaction { Hash }
        }
      }
    }
  `;

  const res = await fetch(BITQUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables: { limit } }),
  });

  if (!res.ok) {
    throw new Error(`Bitquery HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as GraphqlResponse;
  if (json.errors?.length) {
    throw new Error(`Bitquery GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const rows = json.data?.EVM?.DEXTrades ?? [];
  return rows
    .map((row) => ({
      conditionId: row.Market?.ConditionId ?? "",
      price: Number(row.Trade?.Price ?? 0),
      amount: Number(row.Trade?.Amount ?? 0),
      side: String(row.Trade?.Side ?? ""),
      ts: row.Block?.Time ? Date.parse(row.Block.Time) : Date.now(),
    }))
    .filter((t) => t.conditionId && t.price > 0);
}

export async function tryEnrichFromBitquery(
  apiKey: string | undefined,
): Promise<BitqueryTrade[]> {
  if (!apiKey) {
    console.warn("[bitquery] BITQUERY_API_KEY not set — skipping GraphQL backfill");
    return [];
  }

  try {
    const trades = await fetchRecentPolymarketTrades(apiKey, 30);
    console.log(`[bitquery] fetched ${trades.length} recent trades`);
    return trades;
  } catch (err) {
    console.warn(
      "[bitquery] enrichment failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
