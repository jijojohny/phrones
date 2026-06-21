import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";
import { predictSafeAddress } from "./predict.js";

export interface SafeSetupConfig {
  safeAddress: string;
  owners: string[];
  threshold: number;
  chainId: number;
  modules: {
    erc4337: boolean;
    policyGuard: boolean;
  };
  createdAt: string;
}

const CONFIG_PATH = resolve(env.repoRoot, "config/safe-polygon.json");

export function loadSafeConfig(): SafeSetupConfig | null {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as SafeSetupConfig;
  } catch {
    return null;
  }
}

export function saveSafeConfig(config: SafeSetupConfig): void {
  mkdirSync(resolve(env.repoRoot, "config"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function resolveSafeAddress(): string | undefined {
  return env.safeAddressPolygon || loadSafeConfig()?.safeAddress;
}

export function buildSafeEnvSnippet(address: string): string {
  return [
    `SAFE_ADDRESS_POLYGON=${address}`,
    "# Fund Polymarket CLOB via Safe (signatureType=2 in clob-client)",
  ].join("\n");
}

export interface SafeHealthCheck {
  configured: boolean;
  address?: string;
  source: "env" | "config" | "none";
}

export function checkSafeHealth(): SafeHealthCheck {
  if (env.safeAddressPolygon) {
    return { configured: true, address: env.safeAddressPolygon, source: "env" };
  }
  const cfg = loadSafeConfig();
  if (cfg?.safeAddress) {
    return { configured: true, address: cfg.safeAddress, source: "config" };
  }
  return { configured: false, source: "none" };
}
