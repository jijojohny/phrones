#!/usr/bin/env node
import { anchorAuditRecord, readLatestAnchoredRoot } from "./anchor.js";

async function main() {
  const record = {
    cycleId: `phase0-${Date.now()}`,
    ts: new Date().toISOString(),
    note: "Phronesis Phase 0 audit smoke test",
    nav: 1.0,
    tradeCount: 0,
  };

  console.log("Uploading audit blob to 0G Storage...");
  const result = await anchorAuditRecord(record);
  console.log(`Storage rootHash: ${result.storageRootHash}`);
  console.log(`Storage txHash:   ${result.storageTxHash}`);
  console.log(`Merkle root: ${result.merkleRoot}`);
  console.log(`Anchor txHash: ${result.anchorTxHash}`);

  const latest = await readLatestAnchoredRoot();
  console.log("Latest on-chain root:", latest.root);
  console.log("Latest storage hash:", latest.storageHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
