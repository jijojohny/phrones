import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { NextResponse } from "next/server";
import type { MarketState, VaultMetrics } from "@phronesis/shared";
import type { OperatorStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const REPO_ROOT = join(process.cwd(), "../..");

function loadVaultsFromConfig(): VaultMetrics[] {
  const path = resolve(REPO_ROOT, "config/vaults.json");
  const cfg = JSON.parse(readFileSync(path, "utf8")) as {
    vaults: Array<{
      protocol: string;
      vaultAddress: string;
      chainId: number;
      strategyExposure?: Record<string, number>;
    }>;
  };

  return cfg.vaults.map((v) => ({
    protocol: v.protocol,
    vaultAddress: v.vaultAddress,
    chainId: v.chainId,
    totalAssets: "0",
    totalSupply: "0",
    sharePrice: v.protocol === "erc4626" ? 1.0526 : 1.0417,
    utilization: v.protocol === "underlay" ? 0.9 : 0.76,
    openInterest: v.protocol === "polymarket-lp" ? "890000000000" : undefined,
    strategyExposure: v.strategyExposure ?? { default: 1 },
    lastUpdated: Date.now(),
  }));
}

function loadMarketSnapshot(): MarketState {
  const path = resolve(REPO_ROOT, "packages/tee-core/fixtures/market-snapshot.json");
  return JSON.parse(readFileSync(path, "utf8")) as MarketState;
}

export async function GET() {
  const { env } = await import("@phronesis/shared");
  const snapshot = loadMarketSnapshot();
  const vaults = loadVaultsFromConfig();
  const topDiv = snapshot.markets[0]?.divergence ?? 0;

  const status: OperatorStatus = {
    ts: Date.now(),
    fund: {
      address: env.phronesisFundAddress || "",
      nav: env.fundNav,
      totalAssets: env.phronesisFundAddress ? "on-chain" : "—",
      shareSupply: "—",
    },
    feed: {
      marketCount: snapshot.markets.length,
      topDivergence: Math.abs(topDiv),
      healthy: snapshot.markets.length >= 3,
    },
    relayer: {
      pending: 0,
      executed: 0,
      mode: env.executionMode,
      bridgeAddress: env.intentBridgeAddress || "",
    },
    agent: {
      tokenId: 1,
      metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
      oracleConfigured: !!env.phronesisOracleAddress,
    },
    vaults,
    markets: snapshot.markets.map((m) => ({
      conditionId: m.conditionId,
      question: m.question,
      pMarket: m.pMarket,
      pSentiment: m.pSentiment,
      divergence: m.divergence,
    })),
  };

  return NextResponse.json(status);
}
