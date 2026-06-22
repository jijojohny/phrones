import { NextResponse } from "next/server";
import { loadBeta, loadNetwork, loadProduct, loadStablecoins } from "@/lib/config-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rpcUrl = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const network = loadNetwork() as Record<string, unknown>;
  const product = loadProduct();
  const chainId = Number(process.env.OG_CHAIN_ID || network.chainId || "16602");

  return NextResponse.json({
    fundAddress: process.env.PHRONESIS_FUND_ADDRESS || "",
    shareAddress: process.env.PHRONESIS_SHARE_ADDRESS || "",
    oracleAddress: process.env.PHRONESIS_ORACLE_ADDRESS || "",
    memoriaRegistry: process.env.MEMORIA_REGISTRY_ADDRESS || "",
    executorUrl:
      process.env.EXECUTOR_URL ||
      `http://127.0.0.1:${process.env.SEALED_EXECUTOR_PORT || "8787"}`,
    rpcUrl,
    chainId,
    explorerUrl: process.env.OG_EXPLORER_URL || "https://chainscan-galileo.0g.ai",
    stablecoins: loadStablecoins(),
    network: {
      ...network,
      chainId,
      chainIdHex: `0x${chainId.toString(16)}`,
      rpcUrls: [rpcUrl, ...((network.rpcUrls as string[]) ?? []).filter((u) => u !== rpcUrl)],
    },
    beta: loadBeta(),
    product: product ?? {
      name: "Phronesis",
      tagline: "Autonomous prediction-market fund",
      description: "",
      investorPath: "/investor",
      operatorPath: "/operator",
      pillars: [],
    },
  });
}
