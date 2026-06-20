import { env } from "@phronesis/shared";
import type { ExecutionResult, PolymarketOrder } from "@phronesis/shared";

export interface ExecuteOptions {
  mode: "dry-run" | "live";
  cycleId: string;
}

export async function executeOrders(
  orders: PolymarketOrder[],
  opts: ExecuteOptions,
): Promise<ExecutionResult> {
  if (opts.mode === "dry-run") {
    return dryRunExecute(orders, opts.cycleId);
  }
  return liveExecute(orders, opts.cycleId);
}

function dryRunExecute(orders: PolymarketOrder[], cycleId: string): ExecutionResult {
  const orderIds = orders.map((o, i) => `dry-run-${cycleId}-${i}`);

  return {
    mode: "dry-run",
    cycleId,
    ts: Date.now(),
    orders,
    submitted: orders.length,
    skipped: 0,
    violations: [],
    orderIds,
    errors: [],
  };
}

async function liveExecute(orders: PolymarketOrder[], cycleId: string): Promise<ExecutionResult> {
  const hasCreds =
    env.polymarketApiKey && env.polymarketApiSecret && env.polymarketApiPassphrase;

  if (!hasCreds) {
    return {
      mode: "live",
      cycleId,
      ts: Date.now(),
      orders,
      submitted: 0,
      skipped: orders.length,
      violations: [],
      orderIds: [],
      errors: [
        "Live mode requires POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_API_PASSPHRASE",
        "Use --dry-run for paper execution or configure API credentials",
      ],
    };
  }

  const orderIds: string[] = [];
  const errors: string[] = [];

  for (const order of orders) {
    try {
      const id = await postOrderToClob(order);
      orderIds.push(id);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    mode: "live",
    cycleId,
    ts: Date.now(),
    orders,
    submitted: orderIds.length,
    skipped: orders.length - orderIds.length,
    violations: [],
    orderIds,
    errors,
  };
}

/** Placeholder for signed CLOB submission — requires @polymarket/clob-client + session key. */
async function postOrderToClob(order: PolymarketOrder): Promise<string> {
  const host = env.polymarketClobHost;
  const res = await fetch(`${host}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenID: order.tokenId,
      price: order.price,
      size: order.sizeShares,
      side: order.side,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CLOB POST failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { orderID?: string; id?: string };
  return data.orderID ?? data.id ?? `live-${Date.now()}`;
}
