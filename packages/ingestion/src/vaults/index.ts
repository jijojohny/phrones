import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";
import type { VaultMetrics } from "@phronesis/shared";
import { Erc4626VaultAdapter } from "./erc4626.js";
import { PolymarketLpAdapter } from "./polymarket-lp.js";
import { UnderlayVaultAdapter } from "./underlay.js";
import type { VaultAdapter, VaultConfigEntry, VaultRegistryConfig } from "./types.js";

export function loadVaultConfig(configPath?: string): VaultRegistryConfig {
  const rel = configPath ?? (env.vaultConfigPath || "config/vaults.json");
  const path = resolve(env.repoRoot, rel);
  return JSON.parse(readFileSync(path, "utf8")) as VaultRegistryConfig;
}

export function createAdapter(protocol: string, rpcUrl: string, entries: VaultConfigEntry[]): VaultAdapter {
  const underlayMap = new Map(
    entries
      .filter((e) => e.protocol === "underlay")
      .map((e) => [e.vaultAddress.toLowerCase(), e]),
  );

  switch (protocol) {
    case "erc4626":
      return new Erc4626VaultAdapter(rpcUrl);
    case "polymarket-lp":
      return new PolymarketLpAdapter(rpcUrl);
    case "underlay":
      return new UnderlayVaultAdapter(rpcUrl, underlayMap);
    default:
      return new Erc4626VaultAdapter(rpcUrl);
  }
}

function rpcForChain(chainId: number): string {
  if (chainId === 137) return env.polygonRpcUrl;
  return env.ogRpcUrl;
}

export async function indexVaults(config?: VaultRegistryConfig): Promise<VaultMetrics[]> {
  const cfg = config ?? loadVaultConfig();
  const results: VaultMetrics[] = [];

  for (const entry of cfg.vaults) {
    const adapter = createAdapter(entry.protocol, rpcForChain(entry.chainId), cfg.vaults);
    const metrics = await adapter.getMetrics(entry.vaultAddress, entry.chainId);
    if (entry.strategyExposure) {
      metrics.strategyExposure = entry.strategyExposure;
    }
    results.push(metrics);
  }

  return results;
}

export function summarizeVaults(vaults: VaultMetrics[]): string {
  const lines = ["Vault metrics:"];
  for (const v of vaults) {
    lines.push(
      `  [${v.protocol}] ${v.vaultAddress.slice(0, 10)}… chain=${v.chainId} | share=$${v.sharePrice.toFixed(4)} util=${(v.utilization * 100).toFixed(0)}%`,
    );
    const exp = Object.entries(v.strategyExposure)
      .map(([k, n]) => `${k}:${(n * 100).toFixed(0)}%`)
      .join(" ");
    lines.push(`    exposure: ${exp}`);
  }
  return lines.join("\n");
}
