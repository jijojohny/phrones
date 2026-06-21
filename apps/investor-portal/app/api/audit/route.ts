import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const registry = process.env.MEMORIA_REGISTRY_ADDRESS;
  if (!registry) {
    return NextResponse.json({ error: "MEMORIA_REGISTRY_ADDRESS not set" }, { status: 503 });
  }

  const port = process.env.SEALED_EXECUTOR_PORT || "8787";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/audit/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // fall through to direct RPC read via tokenization would need server-side import
  }

  try {
    const { Contract, JsonRpcProvider } = await import("ethers");
    const provider = new JsonRpcProvider(
      process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      Number(process.env.OG_CHAIN_ID || "16602"),
    );
    const reg = new Contract(
      registry,
      ["function latestRoot() view returns (tuple(bytes32 root, bytes32 storageHash, uint256 ts))"],
      provider,
    );
    const entry = await reg.latestRoot();
    return NextResponse.json({
      merkleRoot: entry.root,
      storageHash: entry.storageHash,
      ts: Number(entry.ts) * 1000,
      registryAddress: registry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read registry" },
      { status: 502 },
    );
  }
}
