import { createPublicClient, http, type Address } from "viem";
import { polygon } from "viem/chains";
import { env } from "@phronesis/shared";
import type { SessionKeyPolicy } from "@phronesis/shared";

const POLICY_ABI = [
  {
    type: "function",
    name: "policy",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "validUntil", type: "uint64" },
      { name: "dailyLimitUsdc", type: "uint256" },
      { name: "perTxLimitUsdc", type: "uint256" },
      { name: "maxNavUsdc", type: "uint256" },
      { name: "paused", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "allowedContract",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface OnChainPolicySnapshot {
  validUntil: number;
  dailyLimitUsdc: number;
  perTxLimitUsdc: number;
  maxNavUsdc: number;
  paused: boolean;
}

export async function fetchOnChainPolicy(
  address = env.executionPolicyAddress,
): Promise<OnChainPolicySnapshot | null> {
  if (!address) return null;

  const client = createPublicClient({
    chain: polygon,
    transport: http(env.polygonRpcUrl),
  });

  const raw = await client.readContract({
    address: address as Address,
    abi: POLICY_ABI,
    functionName: "policy",
  });

  return {
    validUntil: Number(raw[0]) * 1000,
    dailyLimitUsdc: Number(raw[1]),
    perTxLimitUsdc: Number(raw[2]),
    maxNavUsdc: Number(raw[3]),
    paused: raw[4],
  };
}

export async function isContractAllowedOnChain(
  target: string,
  address = env.executionPolicyAddress,
): Promise<boolean | null> {
  if (!address) return null;

  const client = createPublicClient({
    chain: polygon,
    transport: http(env.polygonRpcUrl),
  });

  return client.readContract({
    address: address as Address,
    abi: POLICY_ABI,
    functionName: "allowedContract",
    args: [target as Address],
  });
}

export function mergePolicyWithOnChain(
  offChain: SessionKeyPolicy,
  onChain: OnChainPolicySnapshot | null,
): SessionKeyPolicy {
  if (!onChain || onChain.paused) return offChain;

  return {
    ...offChain,
    validUntil: Math.min(offChain.validUntil, onChain.validUntil),
    dailyLimitUsdc: Math.min(offChain.dailyLimitUsdc, onChain.dailyLimitUsdc),
    perTxLimitUsdc: Math.min(offChain.perTxLimitUsdc, onChain.perTxLimitUsdc),
    maxNavUsdc: Math.min(offChain.maxNavUsdc, onChain.maxNavUsdc),
  };
}

export async function loadMergedSessionPolicy(
  loader: () => SessionKeyPolicy,
): Promise<SessionKeyPolicy> {
  const offChain = loader();
  try {
    const onChain = await fetchOnChainPolicy();
    return mergePolicyWithOnChain(offChain, onChain);
  } catch (err) {
    console.warn(
      "[policy] on-chain fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return offChain;
  }
}
