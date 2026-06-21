import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPO_ROOT = resolve(process.cwd(), "../..");
const DATA_DIR = resolve(REPO_ROOT, "data");
const REQUESTS_FILE = resolve(DATA_DIR, "beta-access-requests.jsonl");

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
    userAgent: req.headers.get("user-agent"),
  };

  mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(REQUESTS_FILE, `${JSON.stringify(entry)}\n`);

  return NextResponse.json({ ok: true, message: "Beta access request recorded" });
}
