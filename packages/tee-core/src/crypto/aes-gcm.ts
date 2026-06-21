import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export function deriveAesKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, 32);
}

export interface AesGcmBundle {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  metadataHash: string;
}

export function encryptJson<T extends object>(
  payload: T,
  secret: string,
  salt: string,
): AesGcmBundle {
  const key = deriveAesKey(secret, salt);
  const iv = randomBytes(IV_LEN);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: ALGO,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    metadataHash: `0x${createHash("sha256").update(plaintext).digest("hex")}`,
  };
}

export function decryptJson<T>(
  bundle: AesGcmBundle,
  secret: string,
  salt: string,
): T {
  const key = deriveAesKey(secret, salt);
  const iv = Buffer.from(bundle.iv, "base64");
  const authTag = Buffer.from(bundle.authTag, "base64");
  const ciphertext = Buffer.from(bundle.ciphertext, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as T;

  const hash = `0x${createHash("sha256").update(plaintext).digest("hex")}`;
  if (hash !== bundle.metadataHash) {
    throw new Error("decryption metadata hash mismatch");
  }

  return parsed;
}
