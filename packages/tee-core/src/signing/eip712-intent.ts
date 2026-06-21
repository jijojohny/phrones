import { Wallet, keccak256, toUtf8Bytes, verifyTypedData } from "ethers";
import type { TradeIntent } from "@phronesis/shared";

export const TRADE_INTENT_TYPES: Record<string, { name: string; type: string }[]> = {
  TradeIntent: [
    { name: "marketRef", type: "string" },
    { name: "side", type: "string" },
    { name: "outcome", type: "string" },
    { name: "sizeUsd", type: "uint256" },
    { name: "maxSlippageBps", type: "uint256" },
    { name: "kellyFractionBps", type: "uint256" },
    { name: "pBlendedBps", type: "uint256" },
    { name: "attestationHash", type: "bytes32" },
    { name: "ts", type: "uint256" },
  ],
};

export const TRADE_INTENT_DOMAIN = {
  name: "PhronesisFund",
  version: "1",
  chainId: 137,
} as const;

export function hashTradeIntent(intent: TradeIntent): `0x${string}` {
  const payload = JSON.stringify({
    marketRef: intent.marketRef,
    side: intent.side,
    outcome: intent.outcome,
    sizeUsd: intent.sizeUsd,
    ts: intent.ts,
  });
  return keccak256(toUtf8Bytes(payload)) as `0x${string}`;
}

export function buildIntentTypedData(intent: TradeIntent) {
  return {
    domain: TRADE_INTENT_DOMAIN,
    types: TRADE_INTENT_TYPES,
    value: {
      marketRef: intent.marketRef,
      side: intent.side,
      outcome: intent.outcome,
      sizeUsd: BigInt(Math.round(intent.sizeUsd * 1e6)),
      maxSlippageBps: BigInt(Math.round(intent.maxSlippage * 10_000)),
      kellyFractionBps: BigInt(Math.round(intent.kellyFraction * 10_000)),
      pBlendedBps: BigInt(Math.round(intent.pBlended * 10_000)),
      attestationHash: keccak256(toUtf8Bytes(intent.attestationHash)),
      ts: BigInt(intent.ts),
    },
  };
}

export async function signTradeIntent(
  intent: TradeIntent,
  privateKey: string,
): Promise<TradeIntent> {
  const wallet = new Wallet(privateKey);
  const typed = buildIntentTypedData(intent);
  const signature = (await wallet.signTypedData(
    typed.domain,
    typed.types,
    typed.value,
  )) as `0x${string}`;

  return {
    ...intent,
    intentHash: hashTradeIntent(intent),
    signerAddress: wallet.address as `0x${string}`,
    signature,
  };
}

export async function signTradeIntents(
  intents: TradeIntent[],
  privateKey: string,
): Promise<TradeIntent[]> {
  return Promise.all(intents.map((i) => signTradeIntent(i, privateKey)));
}

export function verifyTradeIntentSignature(intent: TradeIntent): boolean {
  if (!intent.signature || !intent.signerAddress) return false;

  try {
    const typed = buildIntentTypedData(intent);
    const recovered = verifyTypedData(
      typed.domain,
      typed.types,
      typed.value,
      intent.signature,
    );
    return recovered.toLowerCase() === intent.signerAddress.toLowerCase();
  } catch {
    return false;
  }
}
