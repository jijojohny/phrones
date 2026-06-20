#!/usr/bin/env node
import { checkSessionHealth, rotateSessionKey } from "./rotation.js";

const args = process.argv.slice(2);
const ttlHours = Number(args.find((a) => a.startsWith("--ttl="))?.split("=")[1] ?? 24);

if (args.includes("--check")) {
  const health = checkSessionHealth();
  console.log("Session health:");
  console.log(`  Expired: ${health.expired}`);
  console.log(`  TTL:     ${health.ttlHours.toFixed(1)}h`);
  console.log(`  Safe:    ${health.safeAddress ?? "(not configured)"}`);
  process.exit(health.expired ? 1 : 0);
}

const result = rotateSessionKey(ttlHours);
console.log("Session key rotated:");
console.log(`  Address:     ${result.address}`);
console.log(`  Valid until: ${new Date(result.validUntil).toISOString()}`);
console.log(`  Key file:    ${result.keyPath}`);
console.log(`  Policy file: ${result.policyPath}`);
console.log("\nAdd to .env:");
console.log(`  SESSION_KEY_PRIVATE_KEY=<from key file>`);
console.log(`  SESSION_POLICY_PATH=${result.policyPath}`);
