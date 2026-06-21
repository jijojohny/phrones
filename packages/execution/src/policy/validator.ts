import type {
  PolicyCheckResult,
  PolicyViolation,
  SessionKeyPolicy,
  TradeIntent,
} from "@phronesis/shared";
import { verifyTradeIntentSignature } from "@phronesis/tee-core/signing";

export interface PolicyContext {
  policy: SessionKeyPolicy;
  now?: number;
  dailySpentUsdc?: number;
}

export function validateIntents(
  intents: TradeIntent[],
  ctx: PolicyContext,
): PolicyCheckResult {
  const now = ctx.now ?? Date.now();
  const violations: PolicyViolation[] = [];
  const approved: TradeIntent[] = [];
  let batchSpend = ctx.dailySpentUsdc ?? 0;

  if (now >= ctx.policy.validUntil) {
    return {
      ok: false,
      violations: [
        {
          intentIndex: -1,
          marketRef: "*",
          rule: "session_expiry",
          message: "Session key expired",
        },
      ],
      approvedIntents: [],
    };
  }

  for (let i = 0; i < intents.length; i += 1) {
    const intent = intents[i];
    const v = checkIntent(intent, i, ctx.policy, batchSpend, now);
    if (v.length > 0) {
      violations.push(...v);
      continue;
    }
    approved.push(intent);
    batchSpend += intent.sizeUsd;
  }

  return { ok: violations.length === 0, violations, approvedIntents: approved };
}

function checkIntent(
  intent: TradeIntent,
  index: number,
  policy: SessionKeyPolicy,
  dailySpent: number,
  now: number,
): PolicyViolation[] {
  const out: PolicyViolation[] = [];

  if (intent.chainId !== 137) {
    out.push(violation(index, intent.marketRef, "chain", "Polygon only in Phase 3"));
  }

  if (!policy.allowedContracts.some((a) => sameAddr(a, intent.target))) {
    out.push(violation(index, intent.marketRef, "allowed_targets", `Target ${intent.target} not whitelisted`));
  }

  if (intent.sizeUsd > policy.perTxLimitUsdc) {
    out.push(
      violation(
        index,
        intent.marketRef,
        "per_tx_limit",
        `$${intent.sizeUsd.toFixed(0)} exceeds per-tx cap $${policy.perTxLimitUsdc}`,
      ),
    );
  }

  if (dailySpent + intent.sizeUsd > policy.dailyLimitUsdc) {
    out.push(
      violation(
        index,
        intent.marketRef,
        "daily_limit",
        `Would exceed daily cap $${policy.dailyLimitUsdc}`,
      ),
    );
  }

  if (intent.sizeUsd > policy.maxNavUsdc * 0.5) {
    out.push(
      violation(
        index,
        intent.marketRef,
        "concentration",
        "Single intent exceeds 50% of max NAV",
      ),
    );
  }

  if (!intent.attestationHash || intent.attestationHash.length < 4) {
    out.push(violation(index, intent.marketRef, "attestation", "Missing TEE attestation hash"));
  }

  if (intent.signature && !verifyTradeIntentSignature(intent)) {
    out.push(violation(index, intent.marketRef, "signature", "Invalid EIP-712 intent signature"));
  }

  if (intent.calldata && intent.calldata.length >= 10 && policy.allowedSelectors.length > 0) {
    const selector = intent.calldata.slice(0, 10).toLowerCase();
    const allowed = policy.allowedSelectors.some((s) => s.toLowerCase() === selector);
    if (!allowed) {
      out.push(violation(index, intent.marketRef, "allowed_selectors", `Selector ${selector} not allowed`));
    }
  }

  if (intent.ts > now + 60_000) {
    out.push(violation(index, intent.marketRef, "stale", "Intent timestamp in the future"));
  }

  return out;
}

function violation(
  intentIndex: number,
  marketRef: string,
  rule: string,
  message: string,
): PolicyViolation {
  return { intentIndex, marketRef, rule, message };
}

function sameAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function isSessionExpired(policy: SessionKeyPolicy, now = Date.now()): boolean {
  return now >= policy.validUntil;
}

export function sessionTtlHours(policy: SessionKeyPolicy, now = Date.now()): number {
  return Math.max(0, (policy.validUntil - now) / 3_600_000);
}
