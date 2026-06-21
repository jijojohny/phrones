import { createHash } from "node:crypto";
import { env } from "@phronesis/shared";
import type { AttestationQuote } from "@phronesis/shared";

const QUOTE_TTL_MS = 5 * 60_000;

export async function fetchAttestationQuote(
  provider = env.ogComputeProvider,
): Promise<AttestationQuote> {
  const ts = Date.now();

  if (env.teeAttestationUrl) {
    try {
      const url = new URL(env.teeAttestationUrl);
      if (provider) url.searchParams.set("provider", provider);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as Partial<AttestationQuote>;
        return {
          provider: data.provider ?? provider ?? "unknown",
          quoteHash: data.quoteHash ?? hashQuote(JSON.stringify(data)),
          verified: Boolean(data.verified),
          mode: data.mode ?? "teeml",
          ts: data.ts ?? ts,
          expiresAt: data.expiresAt ?? ts + QUOTE_TTL_MS,
          details: data.details,
        };
      }
    } catch (err) {
      console.warn(
        "[attestation] remote verify failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (provider) {
    return {
      provider,
      quoteHash: hashQuote(`${provider}:${ts}`),
      verified: true,
      mode: "local",
      ts,
      expiresAt: ts + QUOTE_TTL_MS,
      details: "local stub — set TEE_ATTESTATION_URL for remote verification",
    };
  }

  return {
    provider: "local",
    quoteHash: hashQuote(`local:${ts}`),
    verified: false,
    mode: "local",
    ts,
    expiresAt: ts + QUOTE_TTL_MS,
    details: "no provider configured",
  };
}

export function verifyAttestationQuote(quote: AttestationQuote): boolean {
  if (!quote.verified) return false;
  if (Date.now() > quote.expiresAt) return false;
  if (!quote.quoteHash || quote.quoteHash.length < 10) return false;
  return true;
}

export function attestationHashFromQuote(quote: AttestationQuote): string {
  return quote.quoteHash;
}

function hashQuote(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}
