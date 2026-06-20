import type { PolymarketOrder, TradeIntent } from "@phronesis/shared";

export interface OrderBuildContext {
  tokenMap: Record<string, string>;
  priceByCondition?: Record<string, number>;
}

export function buildOrders(
  intents: TradeIntent[],
  ctx: OrderBuildContext,
): { orders: PolymarketOrder[]; errors: string[] } {
  const orders: PolymarketOrder[] = [];
  const errors: string[] = [];

  for (const intent of intents) {
    const tokenId = ctx.tokenMap[intent.marketRef];
    if (!tokenId) {
      errors.push(`No tokenId for condition ${intent.marketRef}`);
      continue;
    }

    const refPrice = ctx.priceByCondition?.[intent.marketRef] ?? intent.pBlended;
    const price = clampPrice(refPrice, intent.maxSlippage, intent.side);

    if (price <= 0.01 || price >= 0.99) {
      errors.push(`Invalid price ${price} for ${intent.marketRef}`);
      continue;
    }

    const sizeShares = intent.sizeUsd / price;

    orders.push({
      tokenId,
      conditionId: intent.marketRef,
      question: intent.question,
      price: roundPrice(price),
      sizeShares: roundShares(sizeShares),
      sizeUsd: intent.sizeUsd,
      side: intent.side,
      outcome: intent.outcome,
      maxSlippage: intent.maxSlippage,
    });
  }

  return { orders, errors };
}

function clampPrice(mid: number, slippage: number, side: "BUY" | "SELL"): number {
  if (side === "BUY") return clamp(mid * (1 + slippage), 0.02, 0.98);
  return clamp(mid * (1 - slippage), 0.02, 0.98);
}

function roundPrice(p: number): number {
  return Math.round(p * 1000) / 1000;
}

function roundShares(s: number): number {
  return Math.round(s * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
