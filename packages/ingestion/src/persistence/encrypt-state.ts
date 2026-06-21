import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import type { EncryptedMarketStateBundle, MarketState } from "@phronesis/shared";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "phronesis-market-state-v1", 32);
}

export function encryptMarketState(
  state: MarketState,
  secret: string,
): EncryptedMarketStateBundle {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: ALGO,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    metadataHash: `0x${createHash("sha256").update(plaintext).digest("hex")}`,
    version: state.version,
    ts: state.ts,
  };
}
