#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadJsonBlob } from "@phronesis/audit/storage";
import { env } from "@phronesis/shared";
import { fetchLatestAudit, verifyAuditRoot } from "./audit.js";
import {
  authorizeInvestor,
  checkInvestorAuthorized,
  depositStablecoin,
  formatOg,
  formatShares,
  initializeFundOnChain,
  listOgStablecoins,
  readFundNav,
  readInvestorShares,
  redeemStablecoin,
  registerOracleProof,
  revokeInvestor,
  rotateFundMetadata,
  updateFundNav,
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

async function revokeCmd() {
  const investor = args.find((a) => a.startsWith("--investor="))?.split("=")[1];
  if (!investor) throw new Error("Usage: revoke --investor=0x...");
  const tx = await revokeInvestor(investor);
  console.log(`revokeUsage tx: ${tx}`);
}

async function checkCmd() {
  const investor = args.find((a) => a.startsWith("--investor="))?.split("=")[1];
  if (!investor) throw new Error("Usage: check --investor=0x...");
  const ok = await checkInvestorAuthorized(investor);
  const shares = await readInvestorShares(investor);
  console.log(`Authorized: ${ok}`);
  console.log(`Shares:     ${formatShares(shares)}`);
  process.exit(ok ? 0 : 1);
}

async function depositCmd() {
  const amount = args.find((a) => a.startsWith("--amount="))?.split("=")[1] ?? "0.1";
  const token = args.find((a) => a.startsWith("--token="))?.split("=")[1] ?? "OG";
  const result = await depositStablecoin(token, amount);
  console.log(
    `Deposited ${amount} ${result.token.symbol} → ${formatShares(result.shares)} shares`,
  );
  console.log(`tx: ${result.txHash}`);
}

async function redeemCmd() {
  const sharesArg = args.find((a) => a.startsWith("--shares="))?.split("=")[1];
  const token = args.find((a) => a.startsWith("--token="))?.split("=")[1] ?? "OG";
  if (!sharesArg) throw new Error("Usage: redeem --shares=1.0 [--token=USDC|USDT|OG]");
  const { parseEther } = await import("ethers");
  const shares = parseEther(sharesArg);
  const result = await redeemStablecoin(shares, token);
  console.log(`Redeemed ${sharesArg} shares → ${result.token.symbol}`);
  console.log(`tx: ${result.txHash}`);
}

async function tokensCmd() {
  const coins = listOgStablecoins();
  console.log("Supported deposit tokens (0G):");
  for (const c of coins) {
    const addr = c.native ? "(native OG)" : c.address || `(set FUND_${c.symbol}_ADDRESS_0G)`;
    console.log(`  ${c.symbol.padEnd(5)} ${c.decimals} dec  ${addr}`);
  }
}

async function auditCmd() {
  const rootArg = args.find((a) => a.startsWith("--root="))?.split("=")[1];
  const latest = await fetchLatestAudit();
  if (!latest) {
    console.log("No audit roots in MemoriaRegistry");
    process.exit(1);
  }
  console.log(`Registry: ${latest.registryAddress}`);
  console.log(`Merkle:   ${latest.merkleRoot}`);
  console.log(`Storage:  ${latest.storageHash}`);
  console.log(`Ts:       ${new Date(latest.ts).toISOString()}`);

  if (rootArg) {
    const ok = await verifyAuditRoot(rootArg);
    console.log(`Verify ${rootArg}: ${ok ? "MATCH" : "MISMATCH"}`);
    process.exit(ok ? 0 : 1);
  }
}

async function navCmd() {
  const nav = await readFundNav();
  console.log(`navPerShare: ${formatOg(nav.navPerShare)} OG`);
  console.log(`totalAssets: ${formatOg(nav.totalAssets)} OG`);
}

async function transferDemoCmd() {
  if (!env.phronesisFundAddress) throw new Error("PHRONESIS_FUND_ADDRESS not set");

  const proof = "tee-reencryption-attestation-v1";
  const secret = env.fundEncryptionKey || "phronesis-dev-key-change-me";
  const metadata = buildDefaultMetadata(env.memoriaRegistryAddress || "0x0");
  metadata.version = "1.1.0-transfer";

  const { ciphertext, iv, authTag, metadataHash } = encryptMetadata(metadata, secret);
  const bundle = {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    metadataHash,
  };

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
    case "revoke":
      await revokeCmd();
      break;
    case "check":
      await checkCmd();
      break;
    case "deposit":
      await depositCmd();
      break;
    case "redeem":
      await redeemCmd();
      break;
    case "audit":
      await auditCmd();
      break;
    case "nav":
      await navCmd();
      break;
    case "tokens":
      await tokensCmd();
      break;
    default:
      console.log(`Phronesis tokenization CLI (Phase 4)

Commands:
  encrypt-metadata              Encrypt fund metadata + upload to 0G Storage
  authorize --investor=0x...    Grant investor read access (authorizeUsage)
  revoke --investor=0x...       Revoke investor access
  check --investor=0x...        Verify authorization + share balance
  deposit --amount=0.1 [--token=OG|USDC|USDT]  Deposit into PhronesisFund
  redeem --shares=1.0 [--token=OG|USDC|USDT]   Redeem fractional shares
  tokens                                       List supported stablecoins on 0G
  audit [--root=0x...]          Read latest MemoriaRegistry root / verify
  nav                           Print on-chain NAV per share + total assets
  transfer-demo                 TEE oracle key rotation E2E demo
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
