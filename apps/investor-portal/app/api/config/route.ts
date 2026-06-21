import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPO_ROOT = resolve(process.cwd(), "../..");

function loadStablecoins() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, "config/stablecoins.json"), "utf8");
    const registry = JSON.parse(raw) as Record<
      string,
      Record<string, Record<string, { symbol: string; decimals: number; address?: string; native?: boolean; env?: string }>>
    >;
    const chainId = String(process.env.OG_CHAIN_ID || "16602");
    const entries = registry["0G"]?.[chainId] ?? {};
    return Object.values(entries).map((entry) => ({
      symbol: entry.symbol,
      decimals: entry.decimals,
      native: entry.native === true,
      address: entry.native
        ? ""
        : (entry.env && process.env[entry.env]) || entry.address || "",
    }));
  } catch {
    return [{ symbol: "OG", decimals: 18, native: true, address: "" }];
  }
}

function loadNetwork() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, "config/networks/0g-galileo.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      chainId: 16602,
      chainIdHex: "0x40ea",
      name: "0G Galileo Testnet",
      nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
      rpcUrls: ["https://evmrpc-testnet.0g.ai"],
      blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
      faucetUrl: "https://faucet.0g.ai",
    };
  }
}

function loadBeta() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, "config/beta.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      version: "0.1.0",
      label: "Galileo Testnet Beta",
      tagline: "Autonomous prediction-market fund on 0G",
      minDepositOg: "0.01",
      defaultDepositOg: "0.1",
      disclaimer: "Testnet beta only.",
      supportEmail: "",
      features: { deposit: true, redeem: true, performance: true, requestAccess: true },
      onboarding: [],
    };
  }
}

export async function GET() {
  const rpcUrl = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const network = loadNetwork();

  return NextResponse.json({
    fundAddress: process.env.PHRONESIS_FUND_ADDRESS || "",
    shareAddress: process.env.PHRONESIS_SHARE_ADDRESS || "",
    oracleAddress: process.env.PHRONESIS_ORACLE_ADDRESS || "",
    memoriaRegistry: process.env.MEMORIA_REGISTRY_ADDRESS || "",
    executorUrl: `http://localhost:${process.env.SEALED_EXECUTOR_PORT || "8787"}`,
    rpcUrl,
    chainId: Number(process.env.OG_CHAIN_ID || "16602"),
    explorerUrl: process.env.OG_EXPLORER_URL || "https://chainscan-galileo.0g.ai",
    stablecoins: loadStablecoins(),
    network: { ...network, rpcUrls: [rpcUrl, ...network.rpcUrls.filter((u: string) => u !== rpcUrl)] },
    beta: loadBeta(),
  });
}
