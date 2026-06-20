import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@phronesis/shared";
import type { CrossChainIntent } from "@phronesis/shared";
import { buildOrders } from "@phronesis/execution/polymarket/order-builder";
import { executeOrders } from "@phronesis/execution/polymarket/executor";
import type { TradeIntent } from "@phronesis/shared";

export interface PolygonSubmitOptions {
  mode: "dry-run" | "live";
}

export interface PolygonSubmitResult {
  success: boolean;
  txHash?: string;
  orderId?: string;
  errors: string[];
}

export async function submitToPolygon(
  intent: CrossChainIntent,
  opts: PolygonSubmitOptions,
): Promise<PolygonSubmitResult> {
  if (intent.targetChainId !== 137) {
    return { success: false, errors: [`Unsupported target chain ${intent.targetChainId}`] };
  }

  const tradeIntent: TradeIntent = {
    chainId: 137,
    target: (env.safeAddressPolygon || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    calldata: "0x" as `0x${string}`,
    value: 0n,
    marketRef: intent.marketRef,
    question: intent.question,
    side: intent.side,
    outcome: intent.outcome,
    sizeUsd: intent.sizeUsd,
    maxSlippage: intent.maxSlippage,
    kellyFraction: 0,
    pBlended: 0.5,
    attestationHash: intent.attestationHash,
    ts: intent.ts,
  };

  const tokenMap: Record<string, string> = {};
  const tokenMapPath = resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../execution/fixtures/token-map.json",
  );
  try {
    const raw = readFileSync(tokenMapPath, "utf8");
    Object.assign(tokenMap, JSON.parse(raw) as Record<string, string>);
  } catch {
    // token map optional for dry-run
  }

  const { orders, errors: buildErrors } = buildOrders([tradeIntent], {
    tokenMap,
    priceByCondition: { [intent.marketRef]: 0.5 },
  });

  if (orders.length === 0) {
    return {
      success: opts.mode === "dry-run",
      txHash: opts.mode === "dry-run" ? `0x${"ab".repeat(32)}` : undefined,
      errors: buildErrors.length ? buildErrors : ["No order built — check token-map.json"],
    };
  }

  const execution = await executeOrders(orders, {
    mode: opts.mode,
    cycleId: intent.cycleId,
  });

  const orderId = execution.orderIds[0];
  const txHash =
    opts.mode === "dry-run"
      ? `0x${Buffer.from(`polygon-${intent.intentHash.slice(2, 18)}`).toString("hex").padEnd(64, "0").slice(0, 64)}`
      : orderId
        ? `0x${Buffer.from(orderId).toString("hex").slice(0, 64).padEnd(64, "0")}`
        : undefined;

  return {
    success: execution.submitted > 0,
    txHash,
    orderId,
    errors: [...buildErrors, ...execution.errors],
  };
}
