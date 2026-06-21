import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

export const dynamic = "force-dynamic";

const FUND_ABI = ["function authorizeUsage(address investor, bytes permissions, uint256 expiresAt)"];

function checkOperatorAuth(req: Request): boolean {
  const secret = process.env.OPERATOR_API_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  return req.headers.get("x-operator-secret") === secret;
}

export async function POST(req: Request) {
  if (!checkOperatorAuth(req)) {
    return NextResponse.json({ error: "Unauthorized — set x-operator-secret header" }, { status: 401 });
  }

  let body: { investor?: string; days?: number };
  try {
    body = (await req.json()) as { investor?: string; days?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const investor = body.investor?.trim();
  if (!investor || !/^0x[a-fA-F0-9]{40}$/.test(investor)) {
    return NextResponse.json({ error: "Invalid investor address" }, { status: 400 });
  }

  const fundAddress = process.env.PHRONESIS_FUND_ADDRESS;
  const key = process.env.DEPLOYER_PRIVATE_KEY_TESTNET;
  if (!fundAddress || !key) {
    return NextResponse.json({ error: "Fund or deployer key not configured" }, { status: 503 });
  }

  const days = body.days ?? 30;
  const permissions = JSON.stringify({
    role: "investor",
    expiresAt: Math.floor(Date.now() / 1000) + days * 86400,
    allowedOperations: ["queryPerformance", "queryYield", "queryAuditRoot"],
    deniedOperations: ["executeTrade", "viewStrategy", "viewPrompts"],
    rateLimit: { maxRequestsPerDay: 100 },
  });

  try {
    const provider = new JsonRpcProvider(
      process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      Number(process.env.OG_CHAIN_ID || "16602"),
    );
    const wallet = new Wallet(key, provider);
    const fund = new Contract(fundAddress, FUND_ABI, wallet);
    const expiresAt = Math.floor(Date.now() / 1000) + days * 86400;
    const tx = await fund.authorizeUsage(investor, Buffer.from(permissions, "utf8"), expiresAt);
    const receipt = await tx.wait();
    return NextResponse.json({ ok: true, txHash: receipt.hash as string, investor, expiresAt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Authorize failed" }, { status: 500 });
  }
}
