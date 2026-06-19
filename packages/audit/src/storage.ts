import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";
import { env, requireDeployerKey } from "@phronesis/shared";

export interface StorageUploadResult {
  rootHash: string;
  txHash: string;
}

export async function uploadJsonBlob(payload: unknown): Promise<StorageUploadResult> {
  const rpc = env.ogRpcUrl;
  const indexerUrl = env.ogStorageIndexer;
  const privateKey = requireDeployerKey();

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(privateKey, provider);
  const indexer = new Indexer(indexerUrl);

  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const blob = new MemData(new Uint8Array(bytes));

  const [tree, treeErr] = await blob.merkleTree();
  if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

  const [tx, uploadErr] = await indexer.upload(blob, rpc, signer as never);
  if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);

  if (!("rootHash" in tx)) {
    throw new Error("Fragmented upload not supported in Phase 0 smoke test");
  }

  return {
    rootHash: tx.rootHash,
    txHash: tx.txHash,
  };
}
