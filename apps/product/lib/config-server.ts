import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const APP_ROOT = process.cwd();
export const REPO_ROOT = findRepoRoot();

function findRepoRoot(): string {
  const candidates = [
    resolve(APP_ROOT, "../.."),
    resolve(APP_ROOT, ".."),
    APP_ROOT,
  ];
  for (const root of candidates) {
    if (existsSync(resolve(root, "config/beta.json"))) return root;
  }
  return resolve(APP_ROOT, "../..");
}

function readConfigJson<T>(filename: string): T {
  const candidates = [
    resolve(APP_ROOT, "config", filename),
    resolve(REPO_ROOT, "config", filename),
    resolve(REPO_ROOT, "config/networks", filename),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as T;
    }
  }
  throw new Error(`Config not found: ${filename}`);
}

export function readRepoJson<T>(relativePath: string): T {
  const candidates = [
    resolve(APP_ROOT, relativePath),
    resolve(REPO_ROOT, relativePath),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as T;
    }
  }
  throw new Error(`Config not found: ${relativePath}`);
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
    const registry = readConfigJson<
      Record<string, Record<string, Record<string, { symbol: string; decimals: number; address?: string; native?: boolean; env?: string }>>>
    >("stablecoins.json");
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
    return readConfigJson("0g-galileo.json");
  } catch {
    return {
      chainId: 16602,
      chainIdHex: "0x40da",
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
    return readConfigJson("beta.json");
  } catch {
    return {
      version: "0.1.0",
      label: "Galileo Testnet Beta",
      tagline: "Deposit testnet OG. Own fractional shares in an autonomous prediction-market fund.",
      minDepositOg: "0.01",
      defaultDepositOg: "0.1",
      disclaimer: "Beta on 0G Galileo testnet only. Not investment advice.",
      supportEmail: "",
      features: { deposit: true, redeem: true, performance: true, requestAccess: true },
      onboarding: [
        { id: "connect", title: "Connect wallet", description: "MetaMask, Rabby, 0G Wallet" },
        { id: "network", title: "Switch to 0G Galileo", description: "Chain ID 16602" },
        { id: "deposit", title: "Deposit & own shares", description: "Send OG to mint PHR shares" },
      ],
    };
  }
}

export function loadProduct() {
  try {
    return readRepoJson("config/product.json");
  } catch {
    return null;
  }
}
