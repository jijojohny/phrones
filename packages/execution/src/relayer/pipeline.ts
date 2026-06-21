import type { CognitiveCycleResult, RelayerResult } from "@phronesis/shared";
import { validateIntents } from "../policy/validator.js";
import { loadSessionPolicy, loadTokenMap } from "../config/loader.js";
import { loadMergedSessionPolicy } from "../policy/on-chain.js";
import { recordSpend, loadDailySpend } from "../policy/daily-spend.js";
import { buildOrders } from "../polymarket/order-builder.js";
import { executeOrders } from "../polymarket/executor.js";
import { summarizeFills, trackFills } from "../polymarket/fill-tracker.js";

export interface RelayOptions {
  mode: "dry-run" | "live";
  dailySpentUsdc?: number;
  trackFills?: boolean;
}

export async function relayIntents(
  cycle: CognitiveCycleResult,
  opts: RelayOptions,
): Promise<RelayerResult> {
  const policy = await loadMergedSessionPolicy(loadSessionPolicy);
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

  const spent = opts.dailySpentUsdc ?? loadDailySpend().spentUsdc;
  const policyResult = validateIntents(cycle.intents, {
    policy,
    dailySpentUsdc: spent,
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

  if (opts.mode === "live" && execution.submitted > 0) {
    const totalUsd = orders.reduce((s, o) => s + o.sizeUsd, 0);
    recordSpend(totalUsd, execution.orderIds);
  }

  if (policyResult.violations.length > 0 && execution.skipped === 0) {
    execution.skipped = cycle.intents.length - execution.submitted;
  }

  return {
    attestationValid,
    policy: policyResult,
    execution,
  };
}

export async function formatRelayReport(
  result: RelayerResult,
  opts: { trackFills?: boolean } = {},
): Promise<string> {
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

  if (opts.trackFills) {
    const fills = await trackFills(ex, { mode: ex.mode, poll: true });
    lines.push("\nFills:");
    lines.push(summarizeFills(fills));
  }

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
