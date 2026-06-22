import { NextResponse } from "next/server";
import { appendBetaRequest, persistenceMode } from "@/lib/beta-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { address?: string; email?: string; note?: string };
  try {
    body = (await req.json()) as { address?: string; email?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const entry = {
    address: address.toLowerCase(),
    email: body.email?.trim() || null,
    note: body.note?.trim() || null,
    ts: new Date().toISOString(),
  };

  try {
    await appendBetaRequest(entry);
    return NextResponse.json({ ok: true, storage: persistenceMode() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save request" },
      { status: 500 },
    );
  }
}
