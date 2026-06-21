import { readLatestRoot } from "@phronesis/audit/registry";
import { env } from "@phronesis/shared";

export interface AuditSnapshot {
  merkleRoot: string;
  storageHash: string;
  ts: number;
  registryAddress: string;
}

export async function fetchLatestAudit(): Promise<AuditSnapshot | null> {
  if (!env.memoriaRegistryAddress) return null;

  try {
    const entry = await readLatestRoot();
    return {
      merkleRoot: entry.root,
      storageHash: entry.storageHash,
      ts: Number(entry.ts) * 1000,
      registryAddress: env.memoriaRegistryAddress,
    };
  } catch (err) {
    console.warn(
      "[audit] registry read failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function verifyAuditRoot(expectedRoot: string): Promise<boolean> {
  const latest = await fetchLatestAudit();
  if (!latest) return false;
  return latest.merkleRoot.toLowerCase() === expectedRoot.toLowerCase();
}
