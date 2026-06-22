import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther } from "ethers";
import type { MarketState, VaultMetrics } from "@phronesis/shared";
import { REPO_ROOT } from "@/lib/config-server";
import { readBetaRequests } from "@/lib/beta-store";
import type { OperatorStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function envStr(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? Number(v) : fallback;
}

const FUND_ABI = [
  "function navPerShare() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
];

const SHARE_ABI = ["function totalSupply() view returns (uint256)"];

function loadVaults(): VaultMetrics[] {
  const cfg = JSON.parse(readFileSync(resolve(REPO_ROOT, "config/vaults.json"), "utf8")) as {
    vaults: Array<{ protocol: string; vaultAddress: string; chainId: number; strategyExposure?: Record<string, number> }>;
  };
  return cfg.vaults.map((v) => ({
    protocol: v.protocol,
    vaultAddress: v.vaultAddress,
    chainId: v.chainId,
    totalAssets: "0",
    totalSupply: "0",
    sharePrice: v.protocol === "erc4626" ? 1.0526 : 1.0417,
    utilization: v.protocol === "underlay" ? 0.9 : 0.76,
    strategyExposure: v.strategyExposure ?? { default: 1 },
    lastUpdated: Date.now(),
  }));
}

function loadMarkets(): MarketState {
  return JSON.parse(
    readFileSync(resolve(REPO_ROOT, "packages/tee-core/fixtures/market-snapshot.json"), "utf8"),
  ) as MarketState;
}

function loadPreflight() {
  const checks = [
    { label: "Deployer key", ok: !!process.env.DEPLOYER_PRIVATE_KEY_TESTNET, required: true, detail: "set" },
    { label: "Fund deployed", ok: !!process.env.PHRONESIS_FUND_ADDRESS, required: true, detail: process.env.PHRONESIS_FUND_ADDRESS || "missing" },
    { label: "Registry deployed", ok: !!process.env.MEMORIA_REGISTRY_ADDRESS, required: true, detail: process.env.MEMORIA_REGISTRY_ADDRESS || "missing" },
    { label: "Database", ok: !!process.env.DATABASE_URL, required: false, detail: process.env.DATABASE_URL ? "postgres" : "file (ephemeral on Vercel)" },
  ];
  return { passed: checks.filter((c) => c.required && !c.ok).length === 0, checks };
}

function loadCompliance() {
  try {
    const memo = JSON.parse(readFileSync(resolve(REPO_ROOT, "config/compliance/go-no-go.json"), "utf8")) as {
      jurisdiction: string;
      items: Array<{ required: boolean; status: string }>;
    };
    return {
      blockers: memo.items.filter((i) => i.required && i.status !== "complete").length,
      jurisdiction: memo.jurisdiction,
    };
  } catch {
    return { blockers: -1, jurisdiction: "UNSET" };
  }
}

export async function GET() {
  const snapshot = loadMarkets();
  const betaRequests = await readBetaRequests(20);

  let nav = envNum("FUND_NAV", 10000);
  let navPerShare = 1;
  let totalAssetsStr = "—";
  let totalAssetsOg = "—";
  let shareSupply = "—";

  const fundAddress = envStr("PHRONESIS_FUND_ADDRESS");
  const shareAddress = envStr("PHRONESIS_SHARE_ADDRESS");
  const rpcUrl = envStr("OG_RPC_URL", "https://evmrpc-testnet.0g.ai");
  const chainId = envNum("OG_CHAIN_ID", 16602);

  if (fundAddress) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, chainId);
      const fund = new Contract(fundAddress, FUND_ABI, provider);
      const navRaw = (await fund.navPerShare()) as bigint;
      const assetsRaw = (await fund.totalAssets()) as bigint;
      navPerShare = Number(navRaw) / 1e18;
      totalAssetsOg = formatEther(assetsRaw);
      totalAssetsStr = assetsRaw.toString();

      if (shareAddress) {
        const share = new Contract(shareAddress, SHARE_ABI, provider);
        const supply = (await share.totalSupply()) as bigint;
        shareSupply = formatEther(supply);
        nav = navPerShare * (Number(supply) / 1e18) || Number(assetsRaw) / 1e18;
      } else {
        nav = Number(assetsRaw) / 1e18;
      }
    } catch {
      /* keep defaults */
    }
  }

  const status: OperatorStatus = {
    ts: Date.now(),
    fund: {
      address: fundAddress,
      nav,
      navPerShare,
      totalAssets: totalAssetsStr,
      totalAssetsOg,
      shareSupply,
    },
    feed: {
      marketCount: snapshot.markets.length,
      topDivergence: Math.abs(snapshot.markets[0]?.divergence ?? 0),
      healthy: snapshot.markets.length >= 3,
    },
    relayer: {
      pending: 0,
      executed: 0,
      mode: envStr("EXECUTION_MODE", "dry-run"),
      bridgeAddress: envStr("INTENT_BRIDGE_ADDRESS"),
    },
    agent: {
      tokenId: 1,
      metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
      oracleConfigured: !!envStr("PHRONESIS_ORACLE_ADDRESS"),
    },
    vaults: loadVaults(),
    markets: snapshot.markets.slice(0, 12).map((m) => ({
      conditionId: m.conditionId,
      question: m.question,
      pMarket: m.pMarket,
      pSentiment: m.pSentiment,
      divergence: m.divergence,
    })),
    betaRequests,
    preflight: loadPreflight(),
    compliance: loadCompliance(),
  };

  return NextResponse.json(status);
}
