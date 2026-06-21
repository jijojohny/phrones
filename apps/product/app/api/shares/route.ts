import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther } from "ethers";

export const dynamic = "force-dynamic";

const SHARE_ABI = ["function balanceOf(address) view returns (uint256)"];

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const shareAddress = process.env.PHRONESIS_SHARE_ADDRESS;
  if (!shareAddress) return NextResponse.json({ balance: "0", note: "Share contract not configured" });

  try {
    const provider = new JsonRpcProvider(
      process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      Number(process.env.OG_CHAIN_ID || "16602"),
    );
    const share = new Contract(shareAddress, SHARE_ABI, provider);
    const bal = (await share.balanceOf(address)) as bigint;
    return NextResponse.json({ balance: formatEther(bal) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "RPC error" }, { status: 502 });
  }
}
