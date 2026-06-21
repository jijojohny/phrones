import { BrowserProvider, Contract, parseEther } from "ethers";
import { getProvider } from "./wallet";

const FUND_ABI = [
  "function deposit() payable returns (uint256)",
  "function redeem(uint256 shares)",
  "function depositERC20(address token, uint256 amount) returns (uint256)",
  "function redeemERC20(uint256 shares, address token)",
  "function isAuthorized(address investor) view returns (bool)",
  "function allowedStablecoins(address) view returns (bool)",
] as const;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
] as const;

function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

async function getFundSigner(fundAddress: string) {
  const provider = getProvider();
  if (!provider) throw new Error("Wallet not connected");
  const browser = new BrowserProvider(provider);
  const signer = await browser.getSigner();
  return new Contract(fundAddress, FUND_ABI, signer);
}

export async function depositNative(fundAddress: string, amountOg: string): Promise<{ txHash: string }> {
  const fund = await getFundSigner(fundAddress);
  const tx = await fund.deposit({ value: parseEther(amountOg) });
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string };
}

export async function depositErc20(
  fundAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number,
): Promise<{ txHash: string; approveTxHash?: string }> {
  const provider = getProvider();
  if (!provider) throw new Error("Wallet not connected");
  const browser = new BrowserProvider(provider);
  const signer = await browser.getSigner();
  const fund = new Contract(fundAddress, FUND_ABI, signer);
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const amountRaw = parseTokenAmount(amount, decimals);
  const allowed = (await fund.allowedStablecoins(tokenAddress)) as boolean;
  if (!allowed) throw new Error("Token not allowlisted on fund");
  let approveTxHash: string | undefined;
  const allowance = (await token.allowance(await signer.getAddress(), fundAddress)) as bigint;
  if (allowance < amountRaw) {
    const approveTx = await token.approve(fundAddress, amountRaw);
    const approveReceipt = await approveTx.wait();
    approveTxHash = approveReceipt.hash as string;
  }
  const tx = await fund.depositERC20(tokenAddress, amountRaw);
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string, approveTxHash };
}

export async function redeemNative(fundAddress: string, sharesOg: string): Promise<{ txHash: string }> {
  const fund = await getFundSigner(fundAddress);
  const tx = await fund.redeem(parseEther(sharesOg));
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string };
}

export async function redeemErc20(
  fundAddress: string,
  tokenAddress: string,
  sharesOg: string,
): Promise<{ txHash: string }> {
  const fund = await getFundSigner(fundAddress);
  const tx = await fund.redeemERC20(parseEther(sharesOg), tokenAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.hash as string };
}
