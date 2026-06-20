import assert from "node:assert/strict";
import type { TradeIntent } from "@phronesis/shared";
import { validateIntents } from "./validator.js";

const policy = {
  validUntil: Date.now() + 86_400_000,
  dailyLimitUsdc: 5000,
  perTxLimitUsdc: 1000,
  maxNavUsdc: 1000,
  allowedContracts: ["0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"],
  allowedSelectors: ["0x3629b973"],
};

const baseIntent: TradeIntent = {
  chainId: 137,
  target: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  calldata: "0x",
  value: 0n,
  marketRef: "0xabc",
  question: "Test?",
  side: "BUY",
  outcome: "YES",
  sizeUsd: 500,
  maxSlippage: 0.02,
  kellyFraction: 0.05,
  pBlended: 0.6,
  attestationHash: "tee-local",
  ts: Date.now(),
};

const ok = validateIntents([baseIntent], { policy });
assert.equal(ok.approvedIntents.length, 1);
assert.equal(ok.violations.length, 0);

const tooLarge = validateIntents([{ ...baseIntent, sizeUsd: 1500 }], { policy });
assert.equal(tooLarge.approvedIntents.length, 0);
assert.ok(tooLarge.violations.some((v) => v.rule === "per_tx_limit"));

const badTarget = validateIntents(
  [{ ...baseIntent, target: "0x0000000000000000000000000000000000000001" }],
  { policy },
);
assert.ok(badTarget.violations.some((v) => v.rule === "allowed_targets"));

console.log("Policy validator tests passed");
