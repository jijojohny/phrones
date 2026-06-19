import { Contract, JsonRpcProvider, Wallet, type InterfaceAbi } from "ethers";
import { requireDeployerKey, env } from "@phronesis/shared";

const ABI: InterfaceAbi = [
  "function updateRoot(bytes32 merkleRoot, bytes32 storageRootHash)",
  "function latestRoot() view returns (tuple(bytes32 root, bytes32 storageHash, uint256 ts))",
  "function rootCount() view returns (uint256)",
  "event RootAnchored(bytes32 indexed merkleRoot, bytes32 indexed storageHash, uint256 ts)",
];

export async function anchorRoot(merkleRoot: string, storageRootHash: string): Promise<string> {
  const registryAddress = env.memoriaRegistryAddress;
  if (!registryAddress) {
    throw new Error("MEMORIA_REGISTRY_ADDRESS not set — deploy registry first");
  }

  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const signer = new Wallet(requireDeployerKey(), provider);
  const registry = new Contract(registryAddress, ABI, signer);

  const tx = await registry.updateRoot(merkleRoot, storageRootHash);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function readLatestRoot(): Promise<{ root: string; storageHash: string; ts: bigint }> {
  const registryAddress = env.memoriaRegistryAddress;
  if (!registryAddress) throw new Error("MEMORIA_REGISTRY_ADDRESS not set");

  const provider = new JsonRpcProvider(env.ogRpcUrl);
  const registry = new Contract(registryAddress, ABI, provider);
  const entry = await registry.latestRoot();
  return {
    root: entry.root as string,
    storageHash: entry.storageHash as string,
    ts: entry.ts as bigint,
  };
}
