import type { CognitiveCycleResult, RelayerResult, TradeIntent } from "@phronesis/shared";
import { validateIntents } from "../policy/validator.js";
import { loadSessionPolicy, loadTokenMap } from "../config/loader.js";
import { buildOrders } from "../polymarket/order-builder.js";
import { executeOrders } from "../polymarket/executor.js";
import { simulateFills, summarizeFills } from "../polymarket/fills.js";

export interface RelayOptions {
  mode: "dry-run" | "live";
  dailySpentUsdc?: number;
}

export async function relayIntents(
  cycle: CognitiveCycleResult,
  opts: RelayOptions,
): Promise<RelayerResult> {
  const policy = loadSessionPolicy();
  const attestationValid = cycle.intents.every(
    (i) => i.attestationHash && i.attestationHash.length > 0,
  );

  if (!attestationValid) {
    return {
      attestationValid: false,
      policy: {
        ok: false,
        violations: [
          {
            intentIndex: -1,
            marketRef: "*",
            rule: "attestation",
            message: "Cycle contains intents without attestation",
          },
        ],
        approvedIntents: [],
      },
      execution: emptyExecution(cycle.cycleId, opts.mode),
    };
  }

  const policyResult = validateIntents(cycle.intents, {
    policy,
    dailySpentUsdc: opts.dailySpentUsdc ?? 0,
  });

  const toExecute = policyResult.approvedIntents;
  const tokenMap = loadTokenMap();
  const priceByCondition = Object.fromEntries(
    cycle.opportunities.map((o) => [o.conditionId, o.pBlended]),
  );

  const { orders, errors: buildErrors } = buildOrders(toExecute, {
    tokenMap,
    priceByCondition,
  });

  const execution = await executeOrders(orders, {
    mode: opts.mode,
    cycleId: cycle.cycleId,
  });
  execution.errors.push(...buildErrors);

  if (policyResult.violations.length > 0 && execution.skipped === 0) {
    execution.skipped = cycle.intents.length - execution.submitted;
  }

  return {
    attestationValid,
    policy: policyResult,
    execution,
  };
}

export function formatRelayReport(result: RelayerResult): string {
  const lines: string[] = [];
  lines.push(`Attestation: ${result.attestationValid ? "OK" : "FAIL"}`);
  lines.push(
    `Policy: ${result.policy.approvedIntents.length} approved, ${result.policy.violations.length} violations`,
  );

  for (const v of result.policy.violations) {
    lines.push(`  ✗ [${v.rule}] ${v.marketRef}: ${v.message}`);
  }

  const ex = result.execution;
  lines.push(`Execution (${ex.mode}): ${ex.submitted} submitted, ${ex.skipped} skipped`);
  for (const o of ex.orders) {
    lines.push(
      `  → ${o.side} ${o.outcome} ${o.question.slice(0, 40)} | ${o.sizeShares.toFixed(1)} @ ${o.price.toFixed(3)} ($${o.sizeUsd.toFixed(0)})`,
    );
  }
  for (const e of ex.errors) {
    lines.push(`  ! ${e}`);
  }

  const fills = simulateFills(ex.orders, ex.orderIds);
  lines.push("\nFills:");
  lines.push(summarizeFills(fills));

  return lines.join("\n");
}

function emptyExecution(cycleId: string, mode: "dry-run" | "live") {
  return {
    mode,
    cycleId,
    ts: Date.now(),
    orders: [],
    submitted: 0,
    skipped: 0,
    violations: [],
    orderIds: [],
    errors: ["Relay aborted"],
  };
}

export type { TradeIntent };
