import { createHash, randomBytes } from "node:crypto";
import type { CrossChainIntent, TradeIntent } from "@phronesis/shared";

export const INTENT_DOMAIN = {
  name: "PhronesisIntentBridge",
  version: "1",
  chainId: 16602,
} as const;

export const INTENT_TYPES = {
  CrossChainIntent: [
    { name: "cycleId", type: "string" },
    { name: "targetChainId", type: "uint256" },
    { name: "marketRef", type: "string" },
    { name: "question", type: "string" },
    { name: "side", type: "string" },
    { name: "outcome", type: "string" },
    { name: "sizeUsd", type: "uint256" },
    { name: "maxSlippage", type: "uint256" },
    { name: "attestationHash", type: "string" },
    { name: "ts", type: "uint256" },
  ],
} as const;

export function tradeIntentToCrossChain(intent: TradeIntent, cycleId: string): CrossChainIntent {
  return {
    intentHash: "",
    cycleId,
    targetChainId: intent.chainId === 137 ? 137 : 16602,
    marketRef: intent.marketRef,
    question: intent.question,
    side: intent.side,
    outcome: intent.outcome,
    sizeUsd: intent.sizeUsd,
    maxSlippage: intent.maxSlippage,
    attestationHash: intent.attestationHash,
    ts: intent.ts,
  };
}

export function hashIntent(intent: CrossChainIntent): string {
  const payload = JSON.stringify({
    cycleId: intent.cycleId,
    targetChainId: intent.targetChainId,
    marketRef: intent.marketRef,
    question: intent.question,
    side: intent.side,
    outcome: intent.outcome,
    sizeUsd: intent.sizeUsd,
    maxSlippage: intent.maxSlippage,
    attestationHash: intent.attestationHash,
    ts: intent.ts,
  });
  return `0x${createHash("sha256").update(payload).digest("hex")}`;
}

export function encodeIntentPayload(intent: CrossChainIntent): `0x${string}` {
  const json = JSON.stringify({ ...intent, intentHash: hashIntent(intent) });
  return `0x${Buffer.from(json, "utf8").toString("hex")}` as `0x${string}`;
}

export function decodeIntentPayload(payload: string): CrossChainIntent {
  const hex = payload.startsWith("0x") ? payload.slice(2) : payload;
  return JSON.parse(Buffer.from(hex, "hex").toString("utf8")) as CrossChainIntent;
}

export function mockAttestationHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}
