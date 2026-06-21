#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StrategyConfig } from "@phronesis/shared";
import { writeEncryptedStrategy } from "./encrypted-loader.js";

const args = process.argv.slice(2);
const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

const inPath =
  args.find((a) => a.startsWith("--in="))?.split("=")[1] ??
  resolve(pkgRoot, "fixtures/strategy.default.json");
const outPath =
  args.find((a) => a.startsWith("--out="))?.split("=")[1] ??
  resolve(pkgRoot, "fixtures/strategy.default.encrypted.json");

const config = JSON.parse(readFileSync(inPath, "utf8")) as StrategyConfig;
const bundle = writeEncryptedStrategy(config, outPath);
console.log(`[encrypt-strategy] wrote ${outPath}`);
console.log(`  metadataHash: ${bundle.metadataHash}`);
