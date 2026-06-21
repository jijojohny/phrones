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

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet detected — install MetaMask or Rabby");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("No account returned from wallet");
  return address;
}

export async function getChainId(): Promise<number> {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet");
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export async function switchToNetwork(network: OgNetwork, rpcUrl: string): Promise<void> {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet");
  const chainIdHex = network.chainIdHex || `0x${network.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: chainIdHex,
        chainName: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: [rpcUrl, ...network.rpcUrls.filter((u) => u !== rpcUrl)],
        blockExplorerUrls: network.blockExplorerUrls,
      }],
    });
  }
}

export function shortenAddress(addr: string, chars = 6): string {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}
