import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";
import type { ActiveMarket } from "../polymarket/markets.js";

export interface EntityMapping {
  entityId: string;
  keywords: string[];
  conditionPatterns: string[];
}

export interface EntityMapConfig {
  entities: EntityMapping[];
}

let cached: EntityMapConfig | null = null;

export function loadEntityMap(): EntityMapConfig {
  if (cached) return cached;
  const path = resolve(env.repoRoot, env.sentimentEntityMapPath);
  cached = JSON.parse(readFileSync(path, "utf8")) as EntityMapConfig;
  return cached;
}

export function matchMarketToEntities(market: ActiveMarket): EntityMapping[] {
  const cfg = loadEntityMap();
  const haystack = `${market.question} ${market.slug} ${market.tags.join(" ")}`.toLowerCase();

  return cfg.entities.filter((e) =>
    e.conditionPatterns.some((p) => haystack.includes(p.toLowerCase())),
  );
}

export function entityKeywordBoost(text: string, entities: EntityMapping[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const e of entities) {
    if (e.keywords.some((k) => lower.includes(k.toLowerCase()))) hits += 1;
  }
  return Math.min(1, hits * 0.25);
}
