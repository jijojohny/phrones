#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadJsonBlob } from "@phronesis/audit/storage";
import { env } from "@phronesis/shared";
import {
  authorizeInvestor,
  initializeFundOnChain,
  checkInvestorAuthorized,
  registerOracleProof,
  rotateFundMetadata,
} from "./fund-client.js";
import { buildDefaultMetadata, encryptMetadata } from "./encrypt.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
const cmd = args[0] ?? "help";
const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

async function encryptAndUpload() {
  const secret = env.fundEncryptionKey || "phronesis-dev-key-change-me";
  const memoryRoot = env.memoriaRegistryAddress || "0x0";
  const metadata = buildDefaultMetadata(memoryRoot);

  const { ciphertext, iv, authTag, metadataHash } = encryptMetadata(metadata, secret);

  const bundle = {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    metadataHash,
  };

  console.log("Uploading encrypted metadata blob to 0G Storage...");
  const upload = await uploadJsonBlob(bundle);
  const encryptedURI = `0g://${upload.rootHash}`;

  console.log(`metadataHash:  ${metadataHash}`);
  console.log(`encryptedURI:  ${encryptedURI}`);
  console.log(`storageTxHash: ${upload.txHash}`);

  const outPath = resolve(pkgRoot, "fixtures/encrypted-metadata.json");
  mkdirSync(resolve(pkgRoot, "fixtures"), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ ...bundle, encryptedURI }, null, 2));
  console.log(`Saved ${outPath}`);

  if (env.phronesisFundAddress) {
    console.log("Initializing fund on-chain...");
    const tx = await initializeFundOnChain(metadataHash, encryptedURI);
    console.log(`initialize tx: ${tx}`);
  } else {
    console.log("PHRONESIS_FUND_ADDRESS not set — skip on-chain initialize");
  }
}

async function authorizeCmd() {
  const investor = args.find((a) => a.startsWith("--investor="))?.split("=")[1];
  if (!investor) throw new Error("Usage: authorize --investor=0x...");

  const permissions = {
    role: "investor" as const,
    expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30,
    allowedOperations: ["queryPerformance", "queryYield", "queryAuditRoot"],
    deniedOperations: ["executeTrade", "viewStrategy", "viewPrompts"],
    rateLimit: { maxRequestsPerDay: 100 },
  };

  const tx = await authorizeInvestor(investor, permissions);
  console.log(`authorizeUsage tx: ${tx}`);
  console.log(`Investor ${investor} authorized for 30 days`);
}

async function checkCmd() {
  const investor = args.find((a) => a.startsWith("--investor="))?.split("=")[1];
  if (!investor) throw new Error("Usage: check --investor=0x...");
  const ok = await checkInvestorAuthorized(investor);
  console.log(`Authorized: ${ok}`);
  process.exit(ok ? 0 : 1);
}

async function transferDemoCmd() {
  if (!env.phronesisFundAddress) throw new Error("PHRONESIS_FUND_ADDRESS not set");

  const proof = "tee-reencryption-attestation-v1";
  const secret = env.fundEncryptionKey || "phronesis-dev-key-change-me";
  const metadata = buildDefaultMetadata(env.memoriaRegistryAddress || "0x0");
  metadata.version = "1.1.0-transfer";

  const { ciphertext, iv, authTag, metadataHash } = encryptMetadata(metadata, secret);
  const bundle = { algorithm: "aes-256-gcm", iv: iv.toString("base64"), authTag: authTag.toString("base64"), ciphertext: ciphertext.toString("base64"), metadataHash };

  console.log("1/4 Upload re-encrypted metadata (simulated TEE oracle)...");
  const upload = await uploadJsonBlob(bundle);
  const newURI = `0g://${upload.rootHash}`;

  console.log("2/4 Register oracle transfer proof...");
  const proofTx = await registerOracleProof(proof);
  console.log(`   proof tx: ${proofTx}`);

  console.log("3/4 Rotate on-chain metadata with oracle proof...");
  const rotateTx = await rotateFundMetadata(metadataHash, newURI, proof);
  console.log(`   rotate tx: ${rotateTx}`);

  console.log("4/4 Transfer demo complete");
  console.log(`   newHash: ${metadataHash}`);
  console.log(`   newURI:  ${newURI}`);
}

async function main() {
  switch (cmd) {
    case "encrypt-metadata":
      await encryptAndUpload();
      break;
    case "transfer-demo":
      await transferDemoCmd();
      break;
    case "authorize":
      await authorizeCmd();
      break;
    case "check":
      await checkCmd();
      break;
    default:
      console.log(`Phronesis tokenization CLI

Commands:
  encrypt-metadata   Encrypt fund metadata, upload to 0G Storage, initialize fund
  authorize --investor=0x...   Grant investor read access (authorizeUsage)
  check --investor=0x...       Verify investor authorization
  transfer-demo                TEE oracle key rotation E2E (re-encrypt + rotateMetadata)
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
