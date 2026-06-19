const GAMMA_API = "https://gamma-api.polymarket.com/markets";

export interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  clobTokenIds: string;
  outcomePrices: string;
  outcomes: string;
  volume24hr?: number;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  closed?: boolean;
}

export interface ActiveMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  tokenIds: string[];
  outcomes: string[];
  prices: number[];
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export async function fetchActiveMarkets(limit = 50): Promise<ActiveMarket[]> {
  const url = new URL(GAMMA_API);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("enableOrderBook", "true");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
  }

  const rows = (await res.json()) as GammaMarket[];

  return rows
    .filter((m) => m.acceptingOrders !== false && m.enableOrderBook !== false)
    .map((m) => ({
      id: m.id,
      question: m.question,
      conditionId: m.conditionId,
      slug: m.slug,
      tokenIds: parseJsonArray<string>(m.clobTokenIds),
      outcomes: parseJsonArray<string>(m.outcomes),
      prices: parseJsonArray<string>(m.outcomePrices).map(Number),
    }))
    .filter((m) => m.tokenIds.length > 0);
}

export async function fetchTopMarkets(count = 10): Promise<ActiveMarket[]> {
  const url = new URL(GAMMA_API);
  url.searchParams.set("limit", "100");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("enableOrderBook", "true");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status}`);
  }

  const rows = (await res.json()) as GammaMarket[];

  return rows
    .filter((m) => m.acceptingOrders !== false)
    .slice(0, count)
    .map((m) => ({
      id: m.id,
      question: m.question,
      conditionId: m.conditionId,
      slug: m.slug,
      tokenIds: parseJsonArray<string>(m.clobTokenIds),
      outcomes: parseJsonArray<string>(m.outcomes),
      prices: parseJsonArray<string>(m.outcomePrices).map(Number),
    }))
    .filter((m) => m.tokenIds.length > 0);
}

export function collectAssetIds(markets: ActiveMarket[], maxAssets = 50): string[] {
  const ids: string[] = [];
  for (const market of markets) {
    for (const tokenId of market.tokenIds) {
      if (ids.length >= maxAssets) return ids;
      if (!ids.includes(tokenId)) ids.push(tokenId);
    }
  }
  return ids;
}
