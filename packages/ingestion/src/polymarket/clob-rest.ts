import { env } from "@phronesis/shared";
import type { MarketTick } from "@phronesis/shared";
import { fetchWithRetry } from "../util/fetch-retry.js";

export async function fetchMidpoint(tokenId: string): Promise<number | null> {
  const url = `${env.polymarketClobHost}/midpoint?token_id=${encodeURIComponent(tokenId)}`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { mid?: string | number };
    const mid = Number(data.mid);
    return Number.isFinite(mid) && mid > 0 ? mid : null;
  } catch {
    return null;
  }
}

/** REST gap-fill: fetch midpoints for assets after WS reconnect. */
export async function gapFillAssets(
  assetIds: string[],
  onTick: (tick: MarketTick) => void,
  batchSize = 10,
): Promise<number> {
  let filled = 0;
  const ts = Date.now();

  for (let i = 0; i < assetIds.length; i += batchSize) {
    const batch = assetIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (assetId) => {
        const mid = await fetchMidpoint(assetId);
        if (mid === null) return;
        onTick({
          assetId,
          conditionId: "",
          question: "",
          mid,
          pImplied: mid,
          eventType: "gap_fill",
          ts,
        });
        filled += 1;
      }),
    );
  }

  if (filled > 0) {
    console.log(`[clob-rest] gap-filled ${filled}/${assetIds.length} assets`);
  }
  return filled;
}
