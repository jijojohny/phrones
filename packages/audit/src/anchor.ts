import { anchorRoot, readLatestRoot } from "./registry.js";
import { Sha256MerkleTree } from "./merkle-tree.js";
import { uploadJsonBlob } from "./storage.js";

export interface AnchorResult {
  merkleRoot: string;
  storageRootHash: string;
  storageTxHash: string;
  anchorTxHash: string;
}

export async function anchorAuditRecord(record: unknown): Promise<AnchorResult> {
  const upload = await uploadJsonBlob(record);

  const tree = new Sha256MerkleTree();
  tree.append(JSON.stringify(record));
  const merkleRoot = tree.root();

  const storageRootHash = upload.rootHash.startsWith("0x")
    ? upload.rootHash
    : `0x${upload.rootHash}`;

  const anchorTxHash = await anchorRoot(merkleRoot, storageRootHash);

  return {
    merkleRoot,
    storageRootHash,
    storageTxHash: upload.txHash,
    anchorTxHash,
  };
}

export async function readLatestAnchoredRoot() {
  return readLatestRoot();
}
