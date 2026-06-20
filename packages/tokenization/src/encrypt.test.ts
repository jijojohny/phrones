import assert from "node:assert/strict";
import { buildDefaultMetadata, decryptMetadata, encryptMetadata } from "./encrypt.js";

const secret = "test-secret-key";
const meta = buildDefaultMetadata("0xabc");
const enc = encryptMetadata(meta, secret);
const dec = decryptMetadata(enc.ciphertext, enc.iv, enc.authTag, secret);

assert.equal(dec.version, "1.0.0");
assert.equal(dec.memoryRoot, "0xabc");
assert.ok(enc.metadataHash.startsWith("0x"));

console.log("Metadata encryption tests passed");
