import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { REPO_ROOT } from "@/lib/config-server";

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

  const dir = resolve(REPO_ROOT, "data");
  mkdirSync(dir, { recursive: true });
  appendFileSync(resolve(dir, "beta-access-requests.jsonl"), `${JSON.stringify(entry)}\n`);

  return NextResponse.json({ ok: true });
}
