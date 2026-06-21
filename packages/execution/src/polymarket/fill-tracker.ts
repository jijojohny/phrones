import type { ExecutionResult, FillEvent, PolymarketOrder } from "@phronesis/shared";
import { createPolymarketClient } from "./clob-client.js";
import { createUserWsSession } from "./user-ws.js";

const POLL_MS = 2_000;
const MAX_POLLS = 15;

export async function trackFills(
  execution: ExecutionResult,
  opts: { mode: "dry-run" | "live"; poll?: boolean },
): Promise<FillEvent[]> {
  if (opts.mode === "dry-run" || !opts.poll) {
    return simulateFills(execution.orders, execution.orderIds);
  }

  if (execution.orderIds.length === 0) return [];

  const userWs = await createUserWsSession();
  if (userWs) {
    try {
      const fills = await userWs.waitForFills(execution.orderIds, 30_000);
      userWs.close();
      if (fills.length > 0) {
        return mergeWithOrders(fills, execution.orders, execution.orderIds);
      }
    } catch (err) {
      console.warn(
        "[fills] user WS failed, falling back to REST poll:",
        err instanceof Error ? err.message : err,
      );
      userWs.close();
    }
  }

  const client = await createPolymarketClient();
  if (!client) {
    return simulateFills(execution.orders, execution.orderIds);
  }

  const fills: FillEvent[] = [];
  for (let i = 0; i < execution.orders.length; i++) {
    const order = execution.orders[i];
    const orderId = execution.orderIds[i];
    if (!order || !orderId) continue;
    fills.push(await pollOrderFill(client, order, orderId));
  }
  return fills;
}

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

function mergeWithOrders(
  fills: FillEvent[],
  orders: PolymarketOrder[],
  orderIds: string[],
): FillEvent[] {
  return orderIds.map((orderId, i) => {
    const wsFill = fills.find((f) => f.orderId === orderId);
    if (wsFill) return wsFill;
    const order = orders[i];
    return {
      orderId,
      tokenId: order?.tokenId ?? "",
      conditionId: order?.conditionId ?? "",
      side: order?.side ?? "BUY",
      price: order?.price ?? 0,
      sizeShares: order?.sizeShares ?? 0,
      ts: Date.now(),
      status: "partial" as const,
    };
  });
}

async function pollOrderFill(
  client: NonNullable<Awaited<ReturnType<typeof createPolymarketClient>>>,
  order: PolymarketOrder,
  orderId: string,
): Promise<FillEvent> {
  for (let n = 0; n < MAX_POLLS; n++) {
    const remote = await client.getOrder(orderId);
    if (remote) {
      const matched = (remote.sizeMatched ?? 0) > 0;
      const status = mapStatus(remote.status, matched, order.sizeShares, remote.sizeMatched ?? 0);
      if (status !== "cancelled" || n === MAX_POLLS - 1) {
        return {
          orderId,
          tokenId: order.tokenId,
          conditionId: order.conditionId,
          side: order.side,
          price: order.price,
          sizeShares: remote.sizeMatched ?? order.sizeShares,
          ts: Date.now(),
          status,
        };
      }
    }
    await sleep(POLL_MS);
  }

  return {
    orderId,
    tokenId: order.tokenId,
    conditionId: order.conditionId,
    side: order.side,
    price: order.price,
    sizeShares: 0,
    ts: Date.now(),
    status: "cancelled",
  };
}

function mapStatus(
  remote: string,
  matched: boolean,
  total: number,
  filled: number,
): FillEvent["status"] {
  const s = remote.toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (matched && filled >= total * 0.99) return "matched";
  if (matched) return "partial";
  if (s.includes("live") || s.includes("open")) return "partial";
  return "matched";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
