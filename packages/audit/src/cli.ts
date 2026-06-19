#!/usr/bin/env node
import { anchorRoot, readLatestRoot } from "./registry.js";
import { Sha256MerkleTree } from "./merkle-tree.js";
import { uploadJsonBlob } from "./storage.js";

async function main() {
  const record = {
    cycleId: `phase0-${Date.now()}`,
    ts: new Date().toISOString(),
    note: "Phronesis Phase 0 audit smoke test",
    nav: 1.0,
    tradeCount: 0,
  };

  console.log("Uploading audit blob to 0G Storage...");
  const upload = await uploadJsonBlob(record);
  console.log(`Storage rootHash: ${upload.rootHash}`);
  console.log(`Storage txHash:   ${upload.txHash}`);

  const tree = new Sha256MerkleTree();
  const leaf = tree.append(JSON.stringify({ nav: record.nav, tradeCount: record.tradeCount, ts: record.ts }));
  const merkleRoot = tree.root();

  console.log(`Merkle leaf: ${leaf}`);
  console.log(`Merkle root: ${merkleRoot}`);

  const storageRootHash = upload.rootHash.startsWith("0x")
    ? upload.rootHash
    : `0x${upload.rootHash}`;

  console.log("Anchoring root on MemoriaRegistry...");
  const anchorTx = await anchorRoot(merkleRoot, storageRootHash);
  console.log(`Anchor txHash: ${anchorTx}`);

  const latest = await readLatestRoot();
  console.log("Latest on-chain root:", latest.root);
  console.log("Latest storage hash:", latest.storageHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
