import { NextResponse } from "next/server";
import type { PerformanceReport } from "@phronesis/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const investor = url.searchParams.get("investor");
  if (!investor) {
    return NextResponse.json({ error: "Missing investor" }, { status: 400 });
  }

  const port = process.env.SEALED_EXECUTOR_PORT || "8787";
  const executorBase = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${executorBase}/performance?investor=${investor}`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    if (!process.env.PHRONESIS_FUND_ADDRESS) {
      return NextResponse.json(
        { error: "Sealed executor offline — start with pnpm phase4:executor" },
        { status: 503 },
      );
    }

    const report: PerformanceReport = {
      nav: Number(process.env.FUND_NAV || "10000"),
      navPerShare: 1,
      totalAssets: "0",
      pnl24h: 0,
      pnl30d: 0,
      sharpe: 0,
      maxDrawdown: 0,
      tradeCount: 0,
      lastAuditRoot: process.env.MEMORIA_REGISTRY_ADDRESS || "0x0",
      shareSupply: "0",
      ts: Date.now(),
    };
    return NextResponse.json(report);
  }
}
