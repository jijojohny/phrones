import { AbiCoder, Contract, JsonRpcProvider, Wallet, keccak256 } from "ethers";
import { env } from "@phronesis/shared";
import type { CrossChainIntent, RelaySubmission, RelayerStatus } from "@phronesis/shared";
import { encodeIntentPayload, hashIntent } from "./eip712.js";
import { submitToPolygon } from "./polygon-submitter.js";

const BRIDGE_ABI = [
  "function submitIntent(bytes32 intentHash, uint256 targetChainId, string marketRef, bytes payload, bytes signature) external",
  "function markExecuted(bytes32 intentHash, bytes32 executionTxHash) external",
  "function intents(bytes32) view returns (address signer, uint256 targetChainId, bytes32 intentHash, bytes payload, uint256 submittedAt, bool executed, bytes32 executionTxHash)",
  "function intentCount() view returns (uint256)",
  "event IntentSubmitted(bytes32 indexed intentHash, address indexed signer, uint256 targetChainId, string marketRef, uint256 submittedAt)",
];

export interface RelayOptions {
  mode: "dry-run" | "live";
  signerKey?: string;
  relayerKey?: string;
}

export interface RelayResult {
  intent: CrossChainIntent;
  submitted: boolean;
  executed: boolean;
  ogTxHash?: string;
  polygonTxHash?: string;
  errors: string[];
}

function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
}

function getBridge(): Contract | null {
  if (!env.intentBridgeAddress) return null;
  const signerKey = env.relayerPrivateKey || env.deployerPrivateKey;
  if (!signerKey) return null;
  const wallet = new Wallet(signerKey, getProvider());
  return new Contract(env.intentBridgeAddress, BRIDGE_ABI, wallet);
}

export async function signIntent(intent: CrossChainIntent, privateKey: string): Promise<string> {
  const wallet = new Wallet(privateKey);
  const intentHash = hashIntent(intent);
  const payload = encodeIntentPayload({ ...intent, intentHash });

  const inner = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "bytes"],
      [intentHash, intent.targetChainId, payload],
    ),
  );

  return wallet.signMessage(Buffer.from(inner.slice(2), "hex"));
}

export async function submitIntentToBridge(
  intent: CrossChainIntent,
  signature: string,
  opts: RelayOptions,
): Promise<RelayResult> {
  const intentHash = hashIntent(intent);
  const fullIntent = { ...intent, intentHash };
  const payload = encodeIntentPayload(fullIntent);
  const errors: string[] = [];

  if (opts.mode === "dry-run") {
    const polygonResult = await submitToPolygon(fullIntent, { mode: "dry-run" });
    return {
      intent: fullIntent,
      submitted: true,
      executed: polygonResult.success,
      polygonTxHash: polygonResult.txHash,
      errors: polygonResult.errors,
    };
  }

  const bridge = getBridge();
  if (!bridge) {
    errors.push("INTENT_BRIDGE_ADDRESS and RELAYER_PRIVATE_KEY required for live mode");
    return { intent: fullIntent, submitted: false, executed: false, errors };
  }

  try {
    const tx = await bridge.submitIntent(
      intentHash,
      intent.targetChainId,
      intent.marketRef,
      payload,
      signature,
    );
    const receipt = await tx.wait();
    const ogTxHash = receipt?.hash;

    const polygonResult = await submitToPolygon(fullIntent, { mode: "live" });
    if (polygonResult.success && polygonResult.txHash) {
      const execTx = await bridge.markExecuted(intentHash, polygonResult.txHash);
      await execTx.wait();
    }

    return {
      intent: fullIntent,
      submitted: true,
      executed: polygonResult.success,
      ogTxHash,
      polygonTxHash: polygonResult.txHash,
      errors: [...errors, ...polygonResult.errors],
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { intent: fullIntent, submitted: false, executed: false, errors };
  }
}

export async function relayCrossChainIntents(
  intents: CrossChainIntent[],
  opts: RelayOptions,
): Promise<RelayResult[]> {
  const key = opts.signerKey || env.deployerPrivateKey;
  if (!key) {
    return intents.map((intent) => ({
      intent,
      submitted: false,
      executed: false,
      errors: ["Missing signer key (DEPLOYER_PRIVATE_KEY_TESTNET)"],
    }));
  }

  const results: RelayResult[] = [];
  for (const intent of intents) {
    const signature = await signIntent(intent, key);
    results.push(await submitIntentToBridge(intent, signature, opts));
  }
  return results;
}

export async function fetchRelayerStatus(): Promise<RelayerStatus> {
  const bridge = getBridge();
  if (!bridge) {
    return { pending: 0, executed: 0, bridgeAddress: env.intentBridgeAddress };
  }

  const count = Number(await bridge.intentCount());
  return {
    pending: count,
    executed: 0,
    bridgeAddress: env.intentBridgeAddress,
    lastRelayAt: Date.now(),
  };
}

export async function listRecentSubmissions(limit = 10): Promise<RelaySubmission[]> {
  const bridge = getBridge();
  if (!bridge) return [];

  // Without event indexer, return empty — dashboard uses dry-run fixtures
  void limit;
  return [];
}

export function formatRelayResult(r: RelayResult): string {
  const lines = [
    `Intent ${r.intent.marketRef} → chain ${r.intent.targetChainId}`,
    `  Submitted: ${r.submitted} | Executed: ${r.executed}`,
  ];
  if (r.ogTxHash) lines.push(`  0G tx: ${r.ogTxHash}`);
  if (r.polygonTxHash) lines.push(`  Polygon tx: ${r.polygonTxHash}`);
  for (const e of r.errors) lines.push(`  ! ${e}`);
  return lines.join("\n");
}
