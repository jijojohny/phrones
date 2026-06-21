import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

export const dynamic = "force-dynamic";

const FUND_ABI = ["function isAuthorized(address investor) view returns (bool)"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const fundAddress = process.env.PHRONESIS_FUND_ADDRESS;
  if (!fundAddress) {
    return NextResponse.json({ authorized: false, note: "Fund not configured" });
  }

  try {
    const rpc = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
    const chainId = Number(process.env.OG_CHAIN_ID || "16602");
    const provider = new JsonRpcProvider(rpc, chainId);
    const fund = new Contract(fundAddress, FUND_ABI, provider);
    const authorized = (await fund.isAuthorized(address)) as boolean;
    return NextResponse.json({ authorized, fundAddress });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RPC error" },
      { status: 502 },
    );
  }
}
