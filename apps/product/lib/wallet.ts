import type { EIP1193Provider } from "viem";

export interface OgNetwork {
  chainId: number;
  chainIdHex: string;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  faucetUrl?: string;
}

export interface PortalConfig {
  fundAddress: string;
  shareAddress: string;
  oracleAddress: string;
  memoriaRegistry: string;
  executorUrl: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  stablecoins: { symbol: string; decimals: number; address: string; native?: boolean }[];
  network: OgNetwork;
  beta: BetaConfig;
  product: ProductConfig;
  setup?: { fundConfigured: boolean; shareConfigured: boolean; rpcConfigured: boolean };
}

export interface BetaConfig {
  version: string;
  label: string;
  tagline: string;
  minDepositOg: string;
  defaultDepositOg: string;
  disclaimer: string;
  supportEmail: string;
  features: { deposit: boolean; redeem: boolean; performance: boolean; requestAccess: boolean };
  onboarding: Array<{ id: string; title: string; description: string }>;
}

export interface ProductConfig {
  name: string;
  tagline: string;
  description: string;
  investorPath: string;
  operatorPath: string;
  pillars: Array<{ title: string; body: string }>;
}

type WalletProvider = EIP1193Provider & {
  providers?: WalletProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  is0g?: boolean;
  isOG?: boolean;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

let activeProvider: WalletProvider | null = null;

export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export function parseChainId(value: string | number): number {
  if (typeof value === "number") return value;
  return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
}

export function formatWalletError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: string; data?: { message?: string } };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.data?.message === "string" && o.data.message) return o.data.message;
    try {
      return JSON.stringify(err);
    } catch {
      return "Wallet request failed";
    }
  }
  return "Wallet request failed";
}

function pickWalletProvider(eth: WalletProvider): WalletProvider {
  if (eth.providers?.length) {
    const og = eth.providers.find((p) => p.is0g || p.isOG);
    if (og) return og;
    const nonMetaMask = eth.providers.find((p) => !p.isMetaMask && !p.isRabby);
    if (nonMetaMask) return nonMetaMask;
    return eth.providers[0]!;
  }
  return eth;
}

export function getProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;
  if (activeProvider) return activeProvider;
  if (!window.ethereum) return null;
  return pickWalletProvider(window.ethereum);
}

export function setActiveProvider(provider: WalletProvider | null): void {
  activeProvider = provider;
}

export async function connectWallet(): Promise<string> {
  const eth = typeof window !== "undefined" ? window.ethereum : null;
  if (!eth) throw new Error("No wallet detected — install MetaMask, Rabby, or 0G Wallet");

  const provider = pickWalletProvider(eth);
  activeProvider = provider;

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("No account returned from wallet");
  return address;
}

export async function restoreWalletSession(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

export async function getChainId(provider = getProvider()): Promise<number> {
  if (!provider) throw new Error("No wallet");
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return parseChainId(hex);
}

export function isOnTargetChain(walletChainId: number, targetChainId: number): boolean {
  return walletChainId === targetChainId;
}

export async function switchToNetwork(network: OgNetwork, rpcUrl: string): Promise<void> {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet");

  const chainIdHex = chainIdToHex(network.chainId);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: [rpcUrl, ...network.rpcUrls.filter((u) => u !== rpcUrl)],
          blockExplorerUrls: network.blockExplorerUrls,
        },
      ],
    });
  }
}

export function watchWallet(
  onAccounts: (accounts: string[]) => void,
  onChain: (chainId: number) => void,
): () => void {
  const provider = getProvider();
  if (!provider?.on) return () => {};

  const handleAccounts = (accounts: unknown) => onAccounts(accounts as string[]);
  const handleChain = (chainId: unknown) => onChain(parseChainId(chainId as string));

  provider.on("accountsChanged", handleAccounts);
  provider.on("chainChanged", handleChain);

  return () => {
    provider.removeListener?.("accountsChanged", handleAccounts);
    provider.removeListener?.("chainChanged", handleChain);
  };
}

export function shortenAddress(addr: string, chars = 6): string {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}
