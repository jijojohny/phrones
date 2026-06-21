import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EncryptedStrategyBundle, StrategyConfig } from "@phronesis/shared";
import { env } from "@phronesis/shared";
import { decryptJson, encryptJson } from "../crypto/aes-gcm.js";

const STRATEGY_SALT = "phronesis-strategy-v1";

export function getStrategySecret(): string {
  const key =
    env.strategyEncryptionKey ||
    env.fundEncryptionKey ||
    process.env.TEE_ENCLAVE_MASTER_KEY ||
    "";
  if (!key) {
    throw new Error(
      "STRATEGY_ENCRYPTION_KEY, FUND_ENCRYPTION_KEY, or TEE_ENCLAVE_MASTER_KEY required",
    );
  }
  return key;
}

export function encryptStrategyConfig(
  config: StrategyConfig,
  secret = getStrategySecret(),
): EncryptedStrategyBundle {
  const bundle = encryptJson(config, secret, STRATEGY_SALT);
  return {
    ...bundle,
    version: 1,
    ts: Date.now(),
  };
}

export function decryptStrategyConfig(
  bundle: EncryptedStrategyBundle,
  secret = getStrategySecret(),
): StrategyConfig {
  return decryptJson<StrategyConfig>(bundle, secret, STRATEGY_SALT);
}

export function loadEncryptedStrategy(path?: string): StrategyConfig {
  const filePath =
    path ||
    env.encryptedStrategyPath ||
    resolve(
      fileURLToPath(new URL(".", import.meta.url)),
      "../../fixtures/strategy.default.encrypted.json",
    );
  const bundle = JSON.parse(readFileSync(filePath, "utf8")) as EncryptedStrategyBundle;
  console.log(`[strategy] decrypted from ${filePath} (hash=${bundle.metadataHash.slice(0, 10)}…)`);
  return decryptStrategyConfig(bundle);
}

export function writeEncryptedStrategy(
  config: StrategyConfig,
  outPath: string,
  secret = getStrategySecret(),
): EncryptedStrategyBundle {
  const bundle = encryptStrategyConfig(config, secret);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  return bundle;
}
