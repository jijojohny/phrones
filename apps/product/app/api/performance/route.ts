import { NextResponse } from "next/server";
import type { PerformanceReport } from "@phronesis/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const investor = new URL(req.url).searchParams.get("investor");
  if (!investor) return NextResponse.json({ error: "Missing investor" }, { status: 400 });

  const executorBase =
    process.env.EXECUTOR_URL ||
    `http://127.0.0.1:${process.env.SEALED_EXECUTOR_PORT || "8787"}`;
  try {
    const res = await fetch(`${executorBase.replace(/\/$/, "")}/performance?investor=${investor}`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Performance service offline — start with: pnpm product:executor" },
      { status: 503 },
    );
  }
}
