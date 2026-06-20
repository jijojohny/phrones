import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { env, requireDeployerKey } from "@phronesis/shared";
import type { InvestorPermissions } from "@phronesis/shared";

const FUND_ABI = [
  "function initialize(bytes32 metadataHash, string encryptedURI)",
  "function setMetadata(bytes32 metadataHash, string encryptedURI)",
  "function authorizeUsage(address investor, bytes permissions, uint256 expiresAt)",
  "function revokeUsage(address investor)",
  "function isAuthorized(address investor) view returns (bool)",
  "function deposit() payable returns (uint256)",
  "function redeem(uint256 shares)",
  "function navPerShare() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function shareToken() view returns (address)",
  "function config() view returns (bytes32 metadataHash, string encryptedURI, address smartAccount, uint256 maxAUM)",
  "function rotateMetadata(bytes32 newMetadataHash, string newURI, bytes oracleProof)",
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

  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const runner = signerOrProvider ?? provider;
  return new Contract(address, FUND_ABI, runner);
}

export function getShareContract(fund = getFundContract()): Contract {
  const provider = fund.runner ?? new JsonRpcProvider(env.ogRpcUrl);
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
  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const wallet = new Wallet(requireDeployerKey(), provider);
  const fund = getFundContract(wallet);
  const tx = await fund.initialize(metadataHash, encryptedURI);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function authorizeInvestor(
  investor: string,
  permissions: InvestorPermissions,
): Promise<string> {
  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const wallet = new Wallet(requireDeployerKey(), provider);
  const fund = getFundContract(wallet);
  const payload = JSON.stringify(permissions);
  const tx = await fund.authorizeUsage(investor, Buffer.from(payload, "utf8"), permissions.expiresAt);
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
  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const share = new Contract(shareAddr, SHARE_ABI, provider);
  return (await share.totalSupply()) as bigint;
}

export async function registerOracleProof(proof: string): Promise<string> {
  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const wallet = new Wallet(requireDeployerKey(), provider);
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
  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const wallet = new Wallet(requireDeployerKey(), provider);
  const fund = getFundContract(wallet);
  const tx = await fund.rotateMetadata(newMetadataHash, newURI, Buffer.from(oracleProof, "utf8"));
  const receipt = await tx.wait();
  return receipt.hash as string;
}
