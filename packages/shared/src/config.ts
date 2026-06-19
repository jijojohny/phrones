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
};

export function requireDeployerKey(): string {
  return required("DEPLOYER_PRIVATE_KEY_TESTNET");
}
