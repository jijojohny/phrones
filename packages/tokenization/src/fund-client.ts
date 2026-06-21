import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers";
import { env, requireDeployerKey } from "@phronesis/shared";
import type { InvestorPermissions } from "@phronesis/shared";
import {
  formatStablecoinAmount,
  listOgStablecoins,
  parseStablecoinAmount,
  resolveOgStablecoin,
  type StablecoinConfig,
  type StablecoinSymbol,
} from "./stablecoins.js";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
] as const;

const FUND_ABI = [
  "function initialize(bytes32 metadataHash, string encryptedURI)",
  "function setMetadata(bytes32 metadataHash, string encryptedURI)",
  "function authorizeUsage(address investor, bytes permissions, uint256 expiresAt)",
  "function authorizeUsage(uint256 tokenId, address executor, bytes permissions)",
  "function revokeUsage(address investor)",
  "function isAuthorized(address investor) view returns (bool)",
  "function deposit() payable returns (uint256)",
  "function redeem(uint256 shares)",
  "function depositERC20(address token, uint256 amount) returns (uint256)",
  "function redeemERC20(uint256 shares, address token)",
  "function setStablecoinAllowed(address token, bool allowed, uint8 decimals)",
  "function allowedStablecoins(address) view returns (bool)",
  "function stablecoinBalances(address) view returns (uint256)",
  "function navPerShare() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function shareToken() view returns (address)",
  "function config() view returns (bytes32 metadataHash, string encryptedURI, address smartAccount, uint256 maxAUM)",
  "function rotateMetadata(bytes32 newMetadataHash, string newURI, bytes oracleProof)",
  "function updateNav(uint256 newNavPerShare)",
  "function fundOwner() view returns (address)",
] as const;

const ORACLE_ABI = [
  "function registerProof(bytes32 proofHash)",
  "function verifyProof(bytes proof) view returns (bool)",
] as const;

const SHARE_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
] as const;

export function getFundContract(signerOrProvider?: Wallet | JsonRpcProvider): Contract {
  const address = env.phronesisFundAddress;
  if (!address) throw new Error("PHRONESIS_FUND_ADDRESS not set in .env");

  const provider = new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
  const runner = signerOrProvider ?? provider;
  return new Contract(address, FUND_ABI, runner);
}

export function getShareContract(fund = getFundContract()): Contract {
  const provider = fund.runner ?? new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
  return new Contract(env.phronesisShareAddress || "", SHARE_ABI, provider);
}

export async function resolveShareAddress(): Promise<string> {
  if (env.phronesisShareAddress) return env.phronesisShareAddress;
  const fund = getFundContract();
  return (await fund.shareToken()) as string;
}

export async function initializeFundOnChain(
  metadataHash: string,
  encryptedURI: string,
): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.initialize(metadataHash, encryptedURI);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function authorizeInvestor(
  investor: string,
  permissions: InvestorPermissions,
): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const payload = JSON.stringify(permissions);
  const tx = await fund.authorizeUsage(investor, Buffer.from(payload, "utf8"), permissions.expiresAt);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function authorizeExecutor(
  tokenId: number,
  executor: string,
  permissions: Record<string, unknown>,
): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.authorizeUsage(
    tokenId,
    executor,
    Buffer.from(JSON.stringify(permissions), "utf8"),
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function revokeInvestor(investor: string): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.revokeUsage(investor);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function checkInvestorAuthorized(investor: string): Promise<boolean> {
  const fund = getFundContract();
  return (await fund.isAuthorized(investor)) as boolean;
}

export async function readFundNav(): Promise<{ navPerShare: bigint; totalAssets: bigint }> {
  const fund = getFundContract();
  const navPerShare = (await fund.navPerShare()) as bigint;
  const totalAssets = (await fund.totalAssets()) as bigint;
  return { navPerShare, totalAssets };
}

export async function readShareSupply(): Promise<bigint> {
  const shareAddr = await resolveShareAddress();
  const provider = new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
  const share = new Contract(shareAddr, SHARE_ABI, provider);
  return (await share.totalSupply()) as bigint;
}

export async function readInvestorShares(investor: string): Promise<bigint> {
  const shareAddr = await resolveShareAddress();
  const provider = new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
  const share = new Contract(shareAddr, SHARE_ABI, provider);
  return (await share.balanceOf(investor)) as bigint;
}

export async function depositNative(
  amountOg: string,
  signerKey = requireDeployerKey(),
): Promise<{ shares: bigint; txHash: string; amountWei: bigint }> {
  const wallet = new Wallet(signerKey, new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const amountWei = parseEther(amountOg);
  const tx = await fund.deposit({ value: amountWei });
  const receipt = await tx.wait();
  const shares = (await readInvestorShares(wallet.address)) as bigint;
  return { shares, txHash: receipt.hash as string, amountWei };
}

export async function ensureErc20Allowance(
  tokenAddress: string,
  ownerKey: string,
  spender: string,
  amount: bigint,
): Promise<string | null> {
  const wallet = new Wallet(ownerKey, new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);
  const current = (await token.allowance(wallet.address, spender)) as bigint;
  if (current >= amount) return null;
  const tx = await token.approve(spender, amount);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function depositStablecoin(
  symbol: StablecoinSymbol | string,
  amount: string,
  signerKey = requireDeployerKey(),
): Promise<{ shares: bigint; txHash: string; amountRaw: bigint; token: StablecoinConfig }> {
  const token = resolveOgStablecoin(symbol);
  if (token.native) {
    const native = await depositNative(amount, signerKey);
    return {
      shares: native.shares,
      txHash: native.txHash,
      amountRaw: native.amountWei,
      token,
    };
  }

  const wallet = new Wallet(signerKey, new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const fundAddress = env.phronesisFundAddress;
  if (!fundAddress) throw new Error("PHRONESIS_FUND_ADDRESS not set in .env");

  const amountRaw = parseStablecoinAmount(amount, token.decimals);
  const allowed = (await fund.allowedStablecoins(token.address)) as boolean;
  if (!allowed) {
    throw new Error(
      `${token.symbol} not allowlisted on fund — run: forge script script/AllowStablecoins.s.sol --broadcast`,
    );
  }

  const approveTx = await ensureErc20Allowance(token.address, signerKey, fundAddress, amountRaw);
  if (approveTx) {
    console.log(`approve tx: ${approveTx}`);
  }

  const tx = await fund.depositERC20(token.address, amountRaw);
  const receipt = await tx.wait();
  const shares = (await readInvestorShares(wallet.address)) as bigint;
  return { shares, txHash: receipt.hash as string, amountRaw, token };
}

export async function redeemStablecoin(
  shares: bigint,
  symbol: StablecoinSymbol | string,
  signerKey = requireDeployerKey(),
): Promise<{ txHash: string; token: StablecoinConfig }> {
  const token = resolveOgStablecoin(symbol);
  const wallet = new Wallet(signerKey, new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);

  if (token.native) {
    const result = await redeemShares(shares, signerKey);
    return { txHash: result.txHash, token };
  }

  const allowed = (await fund.allowedStablecoins(token.address)) as boolean;
  if (!allowed) {
    throw new Error(`${token.symbol} not allowlisted on fund`);
  }

  const tx = await fund.redeemERC20(shares, token.address);
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string, token };
}

export async function allowStablecoinOnFund(
  tokenAddress: string,
  decimals = 6,
): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.setStablecoinAllowed(tokenAddress, true, decimals);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export { listOgStablecoins, formatStablecoinAmount, parseStablecoinAmount, resolveOgStablecoin };

export async function redeemShares(
  shares: bigint,
  signerKey = requireDeployerKey(),
): Promise<{ txHash: string }> {
  const wallet = new Wallet(signerKey, new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.redeem(shares);
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string };
}

export async function updateFundNav(navPerShare: bigint): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.updateNav(navPerShare);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function registerOracleProof(proof: string): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  if (!env.phronesisOracleAddress) throw new Error("PHRONESIS_ORACLE_ADDRESS not set");

  const oracle = new Contract(env.phronesisOracleAddress, ORACLE_ABI, wallet);
  const { keccak256, toUtf8Bytes } = await import("ethers");
  const proofHash = keccak256(toUtf8Bytes(proof));
  const tx = await oracle.registerProof(proofHash);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function rotateFundMetadata(
  newMetadataHash: string,
  newURI: string,
  oracleProof: string,
): Promise<string> {
  const wallet = new Wallet(requireDeployerKey(), new JsonRpcProvider(env.ogRpcUrl, env.ogChainId));
  const fund = getFundContract(wallet);
  const tx = await fund.rotateMetadata(newMetadataHash, newURI, Buffer.from(oracleProof, "utf8"));
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export function formatShares(shares: bigint): string {
  return formatEther(shares);
}

export function formatOg(wei: bigint): string {
  return formatEther(wei);
}
