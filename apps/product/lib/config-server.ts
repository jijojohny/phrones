import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const REPO_ROOT = resolve(process.cwd(), "../..");

export function readRepoJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relativePath), "utf8")) as T;
}

export function readBetaRequests(): Array<{
  address: string;
  email: string | null;
  note: string | null;
  ts: string;
}> {
  const file = resolve(REPO_ROOT, "data/beta-access-requests.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { address: string; email: string | null; note: string | null; ts: string });
}

export function loadStablecoins() {
  try {
    const registry = readRepoJson<
      Record<string, Record<string, Record<string, { symbol: string; decimals: number; address?: string; native?: boolean; env?: string }>>>
    >("config/stablecoins.json");
    const chainId = String(process.env.OG_CHAIN_ID || "16602");
    const entries = registry["0G"]?.[chainId] ?? {};
    return Object.values(entries).map((entry) => ({
      symbol: entry.symbol,
      decimals: entry.decimals,
      native: entry.native === true,
      address: entry.native ? "" : (entry.env && process.env[entry.env]) || entry.address || "",
    }));
  } catch {
    return [{ symbol: "OG", decimals: 18, native: true, address: "" }];
  }
}

export function loadNetwork() {
  try {
    return readRepoJson("config/networks/0g-galileo.json");
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

export function loadBeta() {
  try {
    return readRepoJson("config/beta.json");
  } catch {
    return { version: "0.1.0", label: "Beta", tagline: "", minDepositOg: "0.01", defaultDepositOg: "0.1", disclaimer: "", supportEmail: "", features: {}, onboarding: [] };
  }
}

export function loadProduct() {
  try {
    return readRepoJson("config/product.json");
  } catch {
    return null;
  }
}
