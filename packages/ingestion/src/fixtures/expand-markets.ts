import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ActiveMarket } from "../polymarket/markets.js";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const TEMPLATES: Array<{ prefix: string; tags: string[]; baseVol: number }> = [
  { prefix: "crypto", tags: ["crypto"], baseVol: 200_000 },
  { prefix: "macro", tags: ["macro"], baseVol: 150_000 },
  { prefix: "politics", tags: ["politics"], baseVol: 120_000 },
  { prefix: "sports", tags: ["sports"], baseVol: 80_000 },
  { prefix: "ai", tags: ["technology", "ai"], baseVol: 90_000 },
];

export function loadFixtureMarkets(count = 50): ActiveMarket[] {
  const path = resolve(pkgRoot, "fixtures/sample-markets.json");
  const base = JSON.parse(readFileSync(path, "utf8")) as ActiveMarket[];
  if (base.length >= count) return base.slice(0, count);
  return expandMarkets(base, count);
}

export function expandMarkets(base: ActiveMarket[], count: number): ActiveMarket[] {
  const out: ActiveMarket[] = [...base];
  let i = base.length;

  while (out.length < count) {
    const template = base[i % base.length] ?? base[0];
    const meta = TEMPLATES[i % TEMPLATES.length] ?? TEMPLATES[0];
    const n = i + 1;
    const yesPrice = 0.15 + ((i * 17) % 70) / 100;

    out.push({
      id: `fixture-${n}`,
      question: `${template.question.replace(/\?$/, "")} (variant ${n})?`,
      conditionId: `0xfixture${String(n).padStart(4, "0")}`,
      slug: `${meta.prefix}-market-${n}`,
      tokenIds: [`${n}00001`, `${n}00002`],
      outcomes: ["Yes", "No"],
      prices: [yesPrice, 1 - yesPrice],
      volume24hr: meta.baseVol + (i % 10) * 5_000,
      endDate: Date.now() + 86_400_000 * (30 + (i % 180)),
      tags: [...new Set([...template.tags, ...meta.tags])],
    });
    i += 1;
  }

  return out;
}
