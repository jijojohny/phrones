const GAMMA_API = "https://gamma-api.polymarket.com/markets";

import { fetchWithRetry } from "../util/fetch-retry.js";

export interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  clobTokenIds: string;
  outcomePrices: string;
  outcomes: string;
  volume24hr?: number;
  endDate?: string;
  tags?: Array<{ slug: string; label?: string }>;
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
  volume24hr: number;
  endDate?: number;
  tags: string[];
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

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
  }

  const rows = (await res.json()) as GammaMarket[];

  return rows
    .filter((m) => m.acceptingOrders !== false && m.enableOrderBook !== false)
    .map(mapGammaMarket)
    .filter((m) => m.tokenIds.length > 0);
}

function mapGammaMarket(m: GammaMarket): ActiveMarket {
  const endMs = m.endDate ? Date.parse(m.endDate) : undefined;
  return {
    id: m.id,
    question: m.question,
    conditionId: m.conditionId,
    slug: m.slug,
    tokenIds: parseJsonArray<string>(m.clobTokenIds),
    outcomes: parseJsonArray<string>(m.outcomes),
    prices: parseJsonArray<string>(m.outcomePrices).map(Number),
    volume24hr: m.volume24hr ?? 0,
    endDate: Number.isFinite(endMs) ? endMs : undefined,
    tags: (m.tags ?? []).map((t) => t.slug ?? t.label ?? "").filter(Boolean),
  };
}

export async function fetchTopMarkets(count = 10): Promise<ActiveMarket[]> {
  const url = new URL(GAMMA_API);
  url.searchParams.set("limit", "100");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("enableOrderBook", "true");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status}`);
  }

  const rows = (await res.json()) as GammaMarket[];

  return rows
    .filter((m) => m.acceptingOrders !== false)
    .slice(0, count)
    .map(mapGammaMarket)
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
