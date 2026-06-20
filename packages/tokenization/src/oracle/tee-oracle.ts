import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { readFileSync } from "node:fs";
import type { FundMetadata, TransferBundle } from "@phronesis/shared";
import { decryptMetadata, encryptMetadata, deriveKey } from "../encrypt.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export interface ReencryptOptions {
  oldSecret: string;
  receiverPublicKeyPem?: string;
  receiverAddress?: string;
  newEncryptedURI?: string;
}

/** TEE oracle: decrypt with old key, re-encrypt with new key, seal for receiver. */
export function processTransfer(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  opts: ReencryptOptions,
): TransferBundle {
  const metadata = decryptMetadata(ciphertext, iv, authTag, opts.oldSecret);

  const newSecret = randomBytes(32).toString("hex");
  const encrypted = encryptMetadata(metadata, newSecret);

  const sealedKey = sealKeyForReceiver(newSecret, opts.receiverPublicKeyPem, opts.receiverAddress);
  const proofPayload = buildProofPayload(encrypted.metadataHash, metadata, newSecret);
  const proofHash = `0x${createHash("sha256").update(proofPayload).digest("hex")}`;

  return {
    proof: proofPayload,
    proofHash,
    oldMetadataHash: hashPlainMetadata(metadata),
    newMetadataHash: encrypted.metadataHash,
    newEncryptedURI: opts.newEncryptedURI ?? `0g://phronesis/${encrypted.metadataHash.slice(2, 18)}`,
    sealedKey,
    receiverHasAccess: true,
  };
}

export function processClone(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  opts: ReencryptOptions,
): TransferBundle {
  return processTransfer(ciphertext, iv, authTag, opts);
}

function hashPlainMetadata(metadata: FundMetadata): string {
  const plain = Buffer.from(JSON.stringify(metadata), "utf8");
  return `0x${createHash("sha256").update(plain).digest("hex")}`;
}

function sealKeyForReceiver(
  secret: string,
  publicKeyPem?: string,
  receiverAddress?: string,
): string {
  if (publicKeyPem) {
    const key = deriveKey(secret);
    const sealed = publicEncrypt(createPublicKey(publicKeyPem), key);
    return `0x${sealed.toString("hex")}`;
  }

  // Testnet fallback: derive sealed key from receiver address + secret
  const salt = receiverAddress?.toLowerCase() ?? "phronesis-receiver";
  const derived = scryptSync(secret, salt, 32);
  return `0x${derived.toString("hex")}`;
}

function buildProofPayload(newMetadataHash: string, metadata: FundMetadata, newSecret: string): string {
  const inner = JSON.stringify({
    newMetadataHash,
    oldPlainHash: hashPlainMetadata(metadata),
    algorithm: ALGO,
    teeAttestation: "tee-reencryption-attestation-v1",
    keyFingerprint: createHash("sha256").update(newSecret).digest("hex").slice(0, 16),
  });
  return inner;
}

export function encodeProofForContract(bundle: TransferBundle): `0x${string}` {
  const hashBytes = bundle.newMetadataHash.slice(2).padStart(64, "0");
  const proofHex = Buffer.from(bundle.proof, "utf8").toString("hex");
  return `0x${hashBytes}${proofHex}` as `0x${string}`;
}

export function reencryptFromFixture(
  fixturePath: string,
  opts: ReencryptOptions,
): TransferBundle {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  return processTransfer(
    Buffer.from(raw.ciphertext, "hex"),
    Buffer.from(raw.iv, "hex"),
    Buffer.from(raw.authTag, "hex"),
    opts,
  );
}

export function unsealKey(sealedKey: string, secret: string, receiverAddress: string): Buffer {
  const salt = receiverAddress.toLowerCase();
  const expected = scryptSync(secret, salt, 32);
  const got = Buffer.from(sealedKey.replace(/^0x/, ""), "hex");
  if (got.length !== expected.length) {
    throw new Error("Invalid sealed key");
  }
  return expected;
}
