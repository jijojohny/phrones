import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import type { FundMetadata } from "@phronesis/shared";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "phronesis-fund-v1", 32);
}

export function encryptMetadata(
  metadata: FundMetadata,
  secret: string,
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer; metadataHash: string } {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(metadata), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const metadataHash = createHash("sha256").update(plaintext).digest("hex");

  return { ciphertext: encrypted, iv, authTag, metadataHash: `0x${metadataHash}` };
}

export function decryptMetadata(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  secret: string,
): FundMetadata {
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as FundMetadata;
}

export function buildDefaultMetadata(memoryRoot = "0x0"): FundMetadata {
  return {
    version: "1.0.0",
    model: {
      provider: "0g-compute",
      modelId: "qwen/qwen2.5-omni-7b",
      weightsHash: "0x0",
    },
    prompts: {
      system: "<encrypted-at-rest>",
      mandate: "<encrypted-at-rest>",
    },
    riskParams: {
      theta: 0.5,
      maxDrawdown: 0.15,
      maxPositionPct: 0.1,
      divergenceThreshold: 0.08,
    },
    memoryRoot,
    createdAt: Math.floor(Date.now() / 1000),
  };
}
