import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");

loadDotenv({ path: resolve(repoRoot, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  repoRoot,
  ogRpcUrl: optional("OG_RPC_URL", "https://evmrpc-testnet.0g.ai"),
  ogChainId: Number(optional("OG_CHAIN_ID", "16602")),
  ogStorageIndexer: optional(
    "OG_STORAGE_INDEXER",
    "https://indexer-storage-testnet-turbo.0g.ai",
  ),
  deployerPrivateKey: optional("DEPLOYER_PRIVATE_KEY_TESTNET"),
  deployerAddress: optional("DEPLOYER_ADDRESS_TESTNET"),
  memoriaRegistryAddress: optional("MEMORIA_REGISTRY_ADDRESS"),
  polymarketClobHost: optional("POLYMARKET_CLOB_HOST", "https://clob.polymarket.com"),
  polygonRpcUrl: optional("POLYGON_RPC_URL", "https://polygon-rpc.com"),
  bitqueryApiKey: optional("BITQUERY_API_KEY"),
  cryptopanicApiKey: optional("CRYPTOPANIC_API_KEY"),
  newsApiKey: optional("NEWS_API_KEY"),
  redisUrl: optional("REDIS_URL"),
  x402FacilitatorUrl: optional("X402_FACILITATOR_URL"),
  divergenceThreshold: Number(optional("DIVERGENCE_THRESHOLD", "0.08")),
  sentimentAlpha: Number(optional("SENTIMENT_ALPHA", "0.15")),
  minLiquidityUsd: Number(optional("MIN_LIQUIDITY_USD", "10000")),
  minTimeToExpirySec: Number(optional("MIN_TIME_TO_EXPIRY_SEC", "86400")),
  ogComputeProvider: optional("OG_COMPUTE_PROVIDER"),
  ogComputeApiKey: optional("OG_COMPUTE_API_KEY"),
  ogComputeModel: optional("OG_COMPUTE_MODEL", "qwen/qwen2.5-omni-7b"),
  ogComputeProxyUrl: optional(
    "OG_COMPUTE_PROXY_URL",
    "https://compute-network-6.integratenetwork.work/v1/proxy/chat/completions",
  ),
  fundNav: Number(optional("FUND_NAV", "10000")),
  kellyTheta: Number(optional("KELLY_THETA", "0.5")),
  maxPositionPct: Number(optional("MAX_POSITION_PCT", "0.1")),
  maxGrossExposure: Number(optional("MAX_GROSS_EXPOSURE", "0.5")),
  strategyPath: optional("STRATEGY_PATH"),
};

export function requireDeployerKey(): string {
  return required("DEPLOYER_PRIVATE_KEY_TESTNET");
}
