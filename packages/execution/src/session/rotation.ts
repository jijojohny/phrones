import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Wallet } from "ethers";
import { env } from "@phronesis/shared";
import { loadSessionPolicy } from "../config/loader.js";
import { isSessionExpired, sessionTtlHours } from "../policy/validator.js";

const SESSION_DIR = resolve(env.repoRoot, "wallets/session");

export interface SessionRotationResult {
  address: string;
  validUntil: number;
  policyPath: string;
  keyPath: string;
}

export function rotateSessionKey(ttlHours = 24): SessionRotationResult {
  const wallet = Wallet.createRandom();
  const validUntil = Date.now() + ttlHours * 3_600_000;
  const policy = loadSessionPolicy();

  const updatedPolicy = {
    ...policy,
    validUntil,
  };

  mkdirSync(SESSION_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const keyPath = resolve(SESSION_DIR, `session-${stamp}.json`);
  const policyPath = resolve(SESSION_DIR, `policy-${stamp}.json`);

  writeFileSync(
    keyPath,
    JSON.stringify(
      {
        address: wallet.address,
        privateKey: wallet.privateKey,
        createdAt: new Date().toISOString(),
        validUntil: new Date(validUntil).toISOString(),
      },
      null,
      2,
    ),
  );

  writeFileSync(policyPath, JSON.stringify(updatedPolicy, null, 2));

  return {
    address: wallet.address,
    validUntil,
    policyPath,
    keyPath,
  };
}

export function checkSessionHealth(): {
  expired: boolean;
  ttlHours: number;
  safeAddress?: string;
} {
  const policy = loadSessionPolicy();
  return {
    expired: isSessionExpired(policy),
    ttlHours: sessionTtlHours(policy),
    safeAddress: env.safeAddressPolygon || undefined,
  };
}
