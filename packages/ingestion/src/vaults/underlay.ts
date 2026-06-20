import type { VaultMetrics } from "@phronesis/shared";
import type { VaultAdapter, VaultConfigEntry } from "./types.js";

/**
 * Underlay-style risk vault adapter (pluggable until official contracts confirmed).
 * Reads per-vault config for strategy exposure and optional RPC enrichment.
 */
export class UnderlayVaultAdapter implements VaultAdapter {
  readonly protocol = "underlay";

  constructor(
    private readonly rpcUrl: string,
    private readonly configByAddress: Map<string, VaultConfigEntry>,
  ) {}

  async getMetrics(vaultAddress: string, chainId: number): Promise<VaultMetrics> {
    const cfg = this.configByAddress.get(vaultAddress.toLowerCase());
    void this.rpcUrl;

    const exposure = cfg?.strategyExposure ?? {
      "risk-parity": 0.4,
      "prediction-alpha": 0.35,
      cash: 0.25,
    };

    const utilization =
      Object.values(exposure).reduce((s, v) => s + (v > 0 ? v : 0), 0) * 0.9;

    return {
      protocol: this.protocol,
      vaultAddress,
      chainId,
      totalAssets: "5000000000000",
      totalSupply: "4800000000000",
      sharePrice: 1.0417,
      utilization: Math.min(1, utilization),
      openInterest: "1200000000000",
      strategyExposure: exposure,
      lastUpdated: Date.now(),
    };
  }
}
