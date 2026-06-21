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
  ogExplorerUrl: optional("OG_EXPLORER_URL", "https://chainscan-galileo.0g.ai"),
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
  safeAddressPolygon: optional("SAFE_ADDRESS_POLYGON"),
  sessionKeyPrivateKey: optional("SESSION_KEY_PRIVATE_KEY"),
  polymarketApiKey: optional("POLYMARKET_API_KEY"),
  polymarketApiSecret: optional("POLYMARKET_API_SECRET"),
  polymarketApiPassphrase: optional("POLYMARKET_API_PASSPHRASE"),
  executionMode: optional("EXECUTION_MODE", "dry-run"),
  sessionPolicyPath: optional("SESSION_POLICY_PATH"),
  executionPolicyAddress: optional("EXECUTION_POLICY_ADDRESS"),
  phronesisFundAddress: optional("PHRONESIS_FUND_ADDRESS"),
  phronesisShareAddress: optional("PHRONESIS_SHARE_ADDRESS"),
  phronesisOracleAddress: optional("PHRONESIS_ORACLE_ADDRESS"),
  fundEncryptionKey: optional("FUND_ENCRYPTION_KEY"),
  sealedExecutorPort: Number(optional("SEALED_EXECUTOR_PORT", "8787")),
  investorPortalPort: Number(optional("INVESTOR_PORTAL_PORT", "3000")),
  intentBridgeAddress: optional("INTENT_BRIDGE_ADDRESS"),
  relayerPrivateKey: optional("RELAYER_PRIVATE_KEY"),
  operatorDashboardPort: Number(optional("OPERATOR_DASHBOARD_PORT", "3001")),
  vaultConfigPath: optional("VAULT_CONFIG_PATH", "config/vaults.json"),
  daemonCycleSec: Number(optional("DAEMON_CYCLE_SEC", "900")),
  rebalanceThreshold: Number(optional("REBALANCE_THRESHOLD", "0.05")),
  databaseUrl: optional("DATABASE_URL"),
  bitqueryKafkaBrokers: optional("BITQUERY_KAFKA_BROKERS"),
  bitqueryKafkaTopic: optional("BITQUERY_KAFKA_TOPIC", "matic.predictions.proto"),
  bitqueryKafkaGroup: optional("BITQUERY_KAFKA_GROUP", "phronesis-ingestion-v1"),
  marketStateEncryptionKey: optional("MARKET_STATE_ENCRYPTION_KEY"),
  finbertEnabled: optional("FINBERT_ENABLED", "false") === "true",
  finbertModel: optional("FINBERT_MODEL", "Xenova/distilbert-base-uncased-finetuned-sst-2-english"),
  sentimentEntityMapPath: optional("SENTIMENT_ENTITY_MAP_PATH", "config/sentiment-entity-map.json"),
  phase1MetricsPort: Number(optional("PHASE1_METRICS_PORT", "9090")),
  strategyEncryptionKey: optional("STRATEGY_ENCRYPTION_KEY"),
  encryptedStrategyPath: optional("ENCRYPTED_STRATEGY_PATH"),
  teeSignerPrivateKey: optional("TEE_SIGNER_PRIVATE_KEY"),
  teeAttestationUrl: optional("TEE_ATTESTATION_URL"),
  phase2AttestationPort: Number(optional("PHASE2_ATTESTATION_PORT", "9091")),
  maxCorrelation: Number(optional("MAX_CORRELATION", "0.85")),
  maxSnapshotStaleMs: Number(optional("MAX_SNAPSHOT_STALE_MS", "120000")),
};

export function requireDeployerKey(): string {
  return required("DEPLOYER_PRIVATE_KEY_TESTNET");
}
