import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

export const dynamic = "force-dynamic";

const REGISTRY_ABI = [
  "function latestRoot() view returns (bytes32 merkleRoot, bytes32 storageHash, uint256 ts)",
  "function rootCount() view returns (uint256)",
];

export async function GET() {
  const registry = process.env.MEMORIA_REGISTRY_ADDRESS;
  if (!registry) return NextResponse.json({ error: "Registry not configured" }, { status: 404 });

  try {
    const provider = new JsonRpcProvider(
      process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      Number(process.env.OG_CHAIN_ID || "16602"),
    );
    const c = new Contract(registry, REGISTRY_ABI, provider);
    const count = (await c.rootCount()) as bigint;
    if (count === 0n) return NextResponse.json({ error: "No roots anchored" }, { status: 404 });
    const [merkleRoot, storageHash, ts] = (await c.latestRoot()) as [string, string, bigint];
    return NextResponse.json({
      merkleRoot,
      storageHash,
      ts: Number(ts) * 1000,
      registryAddress: registry,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "RPC error" }, { status: 502 });
  }
}
