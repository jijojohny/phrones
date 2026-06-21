#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { anchorAuditRecord } from "@phronesis/audit/anchor";
import { env } from "@phronesis/shared";
import type { MarketState } from "@phronesis/shared";
import { runCognitiveCycle } from "@phronesis/tee-core/pipeline";
import { loadStrategyConfig } from "@phronesis/tee-core/strategy";
import { signTradeIntents } from "@phronesis/tee-core/signing";
import { buildRedactedAuditRecord } from "@phronesis/tee-core/audit";
import { formatRelayReport, relayIntents } from "./relayer/pipeline.js";
import { checkSessionHealth } from "./session/rotation.js";
import { loadSessionPolicy } from "./config/loader.js";
import { loadDailySpend } from "./policy/daily-spend.js";
import { isSessionExpired, sessionTtlHours } from "./policy/validator.js";
import { checkSafeHealth } from "./safe/setup.js";

const args = process.argv.slice(2);
const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const teeRoot = resolve(pkgRoot, "../tee-core");

const dryRun = args.includes("--dry-run") || env.executionMode !== "live";
const live = args.includes("--live");
const anchor = args.includes("--anchor");
const trackFills = args.includes("--track-fills");
const checkSession = args.includes("--check-session");

function loadSnapshot(): MarketState {
  const path = resolve(teeRoot, "fixtures/market-snapshot.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as MarketState;
  const ts = Date.now();
  return {
    ...raw,
    ts,
    markets: raw.markets.map((m) => ({ ...m, updatedAt: ts })),
  };
}

async function main() {
  console.log("=== Phronesis Phase 3 — Execution Layer ===\n");

  const policy = loadSessionPolicy();
  const safe = checkSafeHealth();
  const spend = loadDailySpend();

  console.log(`Session TTL: ${sessionTtlHours(policy).toFixed(1)}h | max NAV: $${policy.maxNavUsdc}`);
  console.log(`Safe (Polygon): ${safe.address ?? "(configure SAFE_ADDRESS_POLYGON)"}`);
  console.log(`Daily spend: $${spend.spentUsdc.toFixed(2)} / $${policy.dailyLimitUsdc}`);
  console.log(`On-chain policy: ${env.executionPolicyAddress ?? "(optional EXECUTION_POLICY_ADDRESS)"}`);
  console.log(`Mode: ${live ? "live" : "dry-run"}\n`);

  if (checkSession) {
    const health = checkSessionHealth();
    console.log(`Session expired: ${health.expired}`);
    if (health.expired) {
      console.log("Run: pnpm phase3:rotate-session");
      process.exit(1);
    }
  }

  if (isSessionExpired(policy)) {
    console.warn("Warning: session policy expired — dry-run continues; live orders blocked");
  }

  const snapshot = loadSnapshot();
  const strategy = loadStrategyConfig();

  console.log("Running cognitive cycle...");
  let cycle = await runCognitiveCycle({
    snapshot,
    strategy,
    attestationHash: "tee-phase3-local",
  });

  const signerKey = env.teeSignerPrivateKey || env.sessionKeyPrivateKey;
  if (signerKey && cycle.intents.length > 0) {
    cycle = { ...cycle, intents: await signTradeIntents(cycle.intents, signerKey) };
  }

  console.log(`Generated ${cycle.intents.length} trade intents\n`);

  const result = await relayIntents(cycle, {
    mode: live ? "live" : "dry-run",
    dailySpentUsdc: spend.spentUsdc,
  });

  console.log(await formatRelayReport(result, { trackFills }));

  if (trackFills && result.execution.submitted > 0) {
    const { trackFills: pollFills, summarizeFills } = await import("./polymarket/fill-tracker.js");
    const fills = await pollFills(result.execution, { mode: live ? "live" : "dry-run", poll: true });
    console.log("\nFill tracking (user WS + REST):");
    console.log(summarizeFills(fills));
  }

  const auditRecord = {
    ...buildRedactedAuditRecord(cycle),
    executionMode: result.execution.mode,
    ordersSubmitted: result.execution.submitted,
    policyViolations: result.policy.violations.length,
    dailySpentUsdc: loadDailySpend().spentUsdc,
  };

  console.log("\nExecution audit summary:");
  console.log(JSON.stringify(auditRecord, null, 2));

  if (anchor) {
    console.log("\nAnchoring execution audit...");
    const anchored = await anchorAuditRecord(auditRecord);
    console.log(`  Merkle: ${anchored.merkleRoot}`);
    console.log(`  Tx:     ${anchored.anchorTxHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
