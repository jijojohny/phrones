import { env } from "@phronesis/shared";
import type { ExecutionResult, PolymarketOrder } from "@phronesis/shared";
import { createPolymarketClient } from "./clob-client.js";

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
  const orderIds: string[] = [];
  const errors: string[] = [];

  let client: Awaited<ReturnType<typeof createPolymarketClient>> = null;
  try {
    client = await createPolymarketClient();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  if (!client) {
    if (!env.polymarketApiKey) {
      errors.push(
        "Live mode requires SESSION_KEY_PRIVATE_KEY + POLYMARKET_API_KEY/SECRET/PASSPHRASE",
      );
    }
    return {
      mode: "live",
      cycleId,
      ts: Date.now(),
      orders,
      submitted: 0,
      skipped: orders.length,
      violations: [],
      orderIds: [],
      errors,
    };
  }

  for (const order of orders) {
    try {
      const result = await client.postLimitOrder(order);
      orderIds.push(result.orderId);
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
