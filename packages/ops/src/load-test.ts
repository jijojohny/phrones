import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MarketState } from "@phronesis/shared";
import { runCognitiveCycle } from "@phronesis/tee-core/pipeline";
import { loadStrategyConfig } from "@phronesis/tee-core/strategy";
import { env } from "@phronesis/shared";

export interface LoadTestReport {
  iterations: number;
  p50Ms: number;
  p99Ms: number;
  maxMs: number;
  minMs: number;
  passed: boolean;
  thresholdMs: number;
}

export async function runCognitiveLoadTest(
  iterations = 50,
  thresholdMs = 5000,
): Promise<LoadTestReport> {
  const snapshotPath = resolve(env.repoRoot, "packages/tee-core/fixtures/market-snapshot.json");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as MarketState;
  const strategy = loadStrategyConfig();

  const latencies: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await runCognitiveCycle({
      snapshot: { ...snapshot, ts: Date.now(), version: i },
      strategy,
      attestationHash: "load-test",
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

  return {
    iterations,
    p50Ms: round(p50),
    p99Ms: round(p99),
    maxMs: round(latencies[latencies.length - 1] ?? 0),
    minMs: round(latencies[0] ?? 0),
    passed: p99 <= thresholdMs,
    thresholdMs,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function printLoadReport(report: LoadTestReport): void {
  console.log(`\nCognitive load test (${report.iterations} iterations)`);
  console.log(`  p50: ${report.p50Ms}ms`);
  console.log(`  p99: ${report.p99Ms}ms (threshold ${report.thresholdMs}ms)`);
  console.log(`  min/max: ${report.minMs}ms / ${report.maxMs}ms`);
  console.log(`  ${report.passed ? "PASSED" : "FAILED"}\n`);
}
