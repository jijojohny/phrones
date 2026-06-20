import type { FillEvent, PolymarketOrder } from "@phronesis/shared";

/** Simulated fill tracker for dry-run; polls CLOB in live mode (stub). */
export function simulateFills(orders: PolymarketOrder[], orderIds: string[]): FillEvent[] {
  const ts = Date.now();
  return orders.map((order, i) => ({
    orderId: orderIds[i] ?? `unknown-${i}`,
    tokenId: order.tokenId,
    conditionId: order.conditionId,
    side: order.side,
    price: order.price,
    sizeShares: order.sizeShares,
    ts,
    status: "matched" as const,
  }));
}

export function summarizeFills(fills: FillEvent[]): string {
  if (fills.length === 0) return "No fills.";
  return fills
    .map(
      (f) =>
        `- ${f.status} ${f.side} ${f.conditionId.slice(0, 10)}… @ ${f.price.toFixed(3)} x ${f.sizeShares.toFixed(1)}`,
    )
    .join("\n");
}
