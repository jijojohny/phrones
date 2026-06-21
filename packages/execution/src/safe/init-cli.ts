#!/usr/bin/env node
import { env } from "@phronesis/shared";
import { checkSafeHealth, saveSafeConfig, type SafeSetupConfig } from "./setup.js";
import { predictSafeAddress } from "./predict.js";

const args = process.argv.slice(2);
const owner = args.find((a) => a.startsWith("--owner="))?.split("=")[1] ?? env.deployerAddress;

async function main(): Promise<void> {
  if (!owner) {
    console.error("Provide --owner=0x... or set DEPLOYER_ADDRESS_TESTNET");
    process.exit(1);
  }

  const address = predictSafeAddress(owner);
  const config: SafeSetupConfig = {
    safeAddress: address,
    owners: [owner],
    threshold: 1,
    chainId: 137,
    modules: { erc4337: true, policyGuard: true },
    createdAt: new Date().toISOString(),
  };

  saveSafeConfig(config);
  const health = checkSafeHealth();

  console.log("=== Safe Polygon setup (Phase 3) ===");
  console.log(`Owner:     ${owner}`);
  console.log(`Predicted: ${address}`);
  console.log(`Health:    ${health.configured ? health.address : "not configured"}`);
  console.log("\nAdd to .env:");
  console.log(`SAFE_ADDRESS_POLYGON=${address}`);
  console.log("\nDeploy real Safe at https://app.safe.global (Polygon), then update .env.");
}

main().catch(console.error);
