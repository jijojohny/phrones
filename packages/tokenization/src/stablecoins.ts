import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";

export type StablecoinSymbol = "OG" | "USDC" | "USDT";

export interface StablecoinConfig {
  symbol: StablecoinSymbol;
  decimals: number;
  address: string;
  native?: boolean;
}

interface StablecoinEntry {
  symbol: string;
  decimals: number;
  address?: string;
  native?: boolean;
  env?: string;
}

const CONFIG_PATH = resolve(env.repoRoot, "config/stablecoins.json");

function loadRegistry(): Record<string, Record<string, Record<string, StablecoinEntry>>> {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<
    string,
    Record<string, Record<string, StablecoinEntry>>
  >;
}

function resolveAddress(entry: StablecoinEntry): string {
  if (entry.native) return "";
  if (entry.env && process.env[entry.env]) return process.env[entry.env]!;
  return entry.address ?? "";
}

/** Supported deposit tokens on 0G Galileo (native OG + allowlisted ERC-20). */
export function listOgStablecoins(): StablecoinConfig[] {
  const chainId = String(env.ogChainId);
  const entries = loadRegistry()["0G"]?.[chainId] ?? {};
  return Object.entries(entries).map(([key, entry]) => ({
    symbol: (entry.symbol || key) as StablecoinSymbol,
    decimals: entry.decimals,
    address: resolveAddress(entry),
    native: entry.native === true,
  }));
}

export function resolveOgStablecoin(symbol: string): StablecoinConfig {
  const normalized = symbol.toUpperCase() as StablecoinSymbol;
  const coin = listOgStablecoins().find((c) => c.symbol === normalized);
  if (!coin) {
    throw new Error(`Unknown token "${symbol}". Supported: ${listOgStablecoins().map((c) => c.symbol).join(", ")}`);
  }
  if (!coin.native && !coin.address) {
    const entry = Object.values(loadRegistry()["0G"]?.[String(env.ogChainId)] ?? {}).find(
      (e) => e.symbol === normalized,
    );
    const envKey = entry?.env ?? `FUND_${normalized}_ADDRESS_0G`;
    throw new Error(`${normalized} address not configured — set ${envKey} in .env`);
  }
  return coin;
}

export function parseStablecoinAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export function formatStablecoinAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
