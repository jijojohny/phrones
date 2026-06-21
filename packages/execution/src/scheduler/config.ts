import { env } from "@phronesis/shared";
import { loadDailySpend } from "../policy/daily-spend.js";
import { checkSafeHealth } from "../safe/setup.js";

export interface SchedulerConfig {
  intervalSec: number;
  mode: "dry-run" | "live";
  trackFills: boolean;
}

export function defaultSchedulerConfig(): SchedulerConfig {
  return {
    intervalSec: Number(process.env.EXECUTION_SCHEDULER_SEC ?? "900"),
    mode: env.executionMode === "live" ? "live" : "dry-run",
    trackFills: true,
  };
}

export function printSchedulerStatus(): void {
  const safe = checkSafeHealth();
  const spend = loadDailySpend();
  console.log(`[scheduler] Safe: ${safe.address ?? "not configured"} (${safe.source})`);
  console.log(`[scheduler] Daily spend: $${spend.spentUsdc.toFixed(2)} on ${spend.date}`);
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
