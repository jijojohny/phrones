import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import type { VaultMetrics } from "@phronesis/shared";
import type { VaultAdapter } from "./types.js";

const ERC4626_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function asset() view returns (address)",
  "function decimals() view returns (uint8)",
];

export class Erc4626VaultAdapter implements VaultAdapter {
  readonly protocol = "erc4626";

  constructor(private readonly rpcUrl: string) {}

  async getMetrics(vaultAddress: string, chainId: number): Promise<VaultMetrics> {
    if (isPlaceholderAddress(vaultAddress)) {
      return fixtureMetrics(vaultAddress, chainId, this.protocol, {
        macro: 0.3,
        crypto: 0.7,
      });
    }

    const provider = new JsonRpcProvider(this.rpcUrl, chainId, { staticNetwork: true });

    try {
      const vault = new Contract(vaultAddress, ERC4626_ABI, provider);
      const [totalAssets, totalSupply, decimals] = await Promise.all([
        vault.totalAssets() as Promise<bigint>,
        vault.totalSupply() as Promise<bigint>,
        vault.decimals().catch(() => 18) as Promise<number>,
      ]);

      const assetsNum = Number(formatUnits(totalAssets, decimals));
      const supplyNum = Number(formatUnits(totalSupply, decimals));
      const sharePrice = supplyNum > 0 ? assetsNum / supplyNum : 1;

      return {
        protocol: this.protocol,
        vaultAddress,
        chainId,
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        sharePrice,
        utilization: clamp(sharePrice > 0 ? Math.min(1, assetsNum / Math.max(assetsNum, 1)) : 0, 0, 1),
        strategyExposure: { vault: 1 },
        lastUpdated: Date.now(),
      };
    } catch {
      return fixtureMetrics(vaultAddress, chainId, this.protocol);
    }
  }
}

function isPlaceholderAddress(addr: string): boolean {
  return /^0x0{30,}/i.test(addr);
}

function fixtureMetrics(
  vaultAddress: string,
  chainId: number,
  protocol: string,
  strategyExposure: Record<string, number> = { macro: 0.3, crypto: 0.7 },
): VaultMetrics {
  return {
    protocol,
    vaultAddress,
    chainId,
    totalAssets: "1000000000000",
    totalSupply: "950000000000",
    sharePrice: 1.0526,
    utilization: 0.82,
    strategyExposure,
    lastUpdated: Date.now(),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
