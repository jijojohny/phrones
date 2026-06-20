import type { VaultMetrics } from "@phronesis/shared";

export interface VaultAdapter {
  readonly protocol: string;
  getMetrics(vaultAddress: string, chainId: number): Promise<VaultMetrics>;
}

export interface VaultConfigEntry {
  protocol: string;
  vaultAddress: string;
  chainId: number;
  label?: string;
  strategyExposure?: Record<string, number>;
}

export interface VaultRegistryConfig {
  vaults: VaultConfigEntry[];
}
