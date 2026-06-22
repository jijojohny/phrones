import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "@/lib/config-server";

export interface BetaAccessRequest {
  address: string;
  email: string | null;
  note: string | null;
  ts: string;
}

type PgPool = import("pg").Pool;

declare global {
  // eslint-disable-next-line no-var
  var __phronesisPgPool: PgPool | undefined;
}

function filePath(): string {
  return resolve(REPO_ROOT, "data/beta-access-requests.jsonl");
}

function readFromFile(limit: number): BetaAccessRequest[] {
  const file = filePath();
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BetaAccessRequest)
    .slice(-limit)
    .reverse();
}

function appendToFile(entry: BetaAccessRequest): void {
  const dir = resolve(REPO_ROOT, "data");
  mkdirSync(dir, { recursive: true });
  appendFileSync(filePath(), `${JSON.stringify(entry)}\n`);
}

async function getPool(): Promise<PgPool | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  if (!global.__phronesisPgPool) {
    const { Pool } = await import("pg");
    global.__phronesisPgPool = new Pool({
      connectionString: url,
      ssl: url.includes("sslmode=require") || url.includes("railway.app")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 3,
    });
  }
  return global.__phronesisPgPool;
}

async function ensureSchema(pool: PgPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beta_access_requests (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      email TEXT,
      note TEXT,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_beta_access_ts ON beta_access_requests (ts DESC);
  `);
}

export function persistenceMode(): "postgres" | "file" {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "file";
}

export async function appendBetaRequest(entry: BetaAccessRequest): Promise<void> {
  const pool = await getPool();
  if (pool) {
    await ensureSchema(pool);
    await pool.query(
      `INSERT INTO beta_access_requests (address, email, note, ts) VALUES ($1, $2, $3, $4::timestamptz)`,
      [entry.address, entry.email, entry.note, entry.ts],
    );
    return;
  }
  appendToFile(entry);
}

export async function readBetaRequests(limit = 50): Promise<BetaAccessRequest[]> {
  const pool = await getPool();
  if (pool) {
    await ensureSchema(pool);
    const result = await pool.query<{ address: string; email: string | null; note: string | null; ts: Date }>(
      `SELECT address, email, note, ts FROM beta_access_requests ORDER BY ts DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      address: row.address,
      email: row.email,
      note: row.note,
      ts: row.ts instanceof Date ? row.ts.toISOString() : String(row.ts),
    }));
  }
  return readFromFile(limit);
}
