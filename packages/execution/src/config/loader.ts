import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionKeyPolicy } from "@phronesis/shared";
import { env } from "@phronesis/shared";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const DEFAULT_POLICY: SessionKeyPolicy = {
  validUntil: Date.now() + 86_400_000,
  dailyLimitUsdc: 5000,
  perTxLimitUsdc: 1000,
  maxNavUsdc: 1000,
  allowedContracts: [
    "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  ],
  allowedSelectors: ["0x3629b973", "0xa9059cbb", "0x095ea7b3"],
};

export function loadSessionPolicy(customPath?: string): SessionKeyPolicy {
  const defaultPath = resolve(pkgRoot, "fixtures/session-policy.json");
  const path = customPath || (env.sessionPolicyPath ? env.sessionPolicyPath : defaultPath);

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as SessionKeyPolicy;
    return { ...DEFAULT_POLICY, ...raw };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[policy] using defaults (${path}: ${msg})`);
    return DEFAULT_POLICY;
  }
}

export function loadTokenMap(customPath?: string): Record<string, string> {
  const path = customPath ?? resolve(pkgRoot, "fixtures/token-map.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
}
