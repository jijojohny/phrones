import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StrategyConfig } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { loadEncryptedStrategy } from "./encrypted-loader.js";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const DEFAULT_STRATEGY: StrategyConfig = {
  nav: env.fundNav,
  kellyTheta: env.kellyTheta,
  maxPositionPct: env.maxPositionPct,
  maxGrossExposure: env.maxGrossExposure,
  minBetUsd: 25,
  maxDrawdownPct: 0.15,
  minHoursToExpiry: 24,
  wMarket: 0.4,
  wModel: 0.35,
  wSentiment: 0.25,
  divergenceThreshold: env.divergenceThreshold,
  minLiquidityUsd: env.minLiquidityUsd,
  bannedMarkets: [],
  categories: ["crypto", "macro", "politics"],
};

export function loadStrategyConfig(customPath?: string): StrategyConfig {
  if (env.encryptedStrategyPath || customPath?.endsWith(".encrypted.json")) {
    try {
      return loadEncryptedStrategy(customPath ?? env.encryptedStrategyPath);
    } catch (err) {
      console.warn(
        "[strategy] encrypted load failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const defaultPath = resolve(pkgRoot, "fixtures/strategy.default.json");
  const path = customPath || (env.strategyPath ? env.strategyPath : defaultPath);

  if (path.endsWith(".encrypted.json")) {
    return loadEncryptedStrategy(path);
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<StrategyConfig>;
    return { ...DEFAULT_STRATEGY, ...raw, nav: raw.nav ?? env.fundNav };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[strategy] using defaults (${path}: ${msg})`);
    return DEFAULT_STRATEGY;
  }
}
