import { indexVaults, loadVaultConfig, summarizeVaults } from "./vaults/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const fixture = args.includes("--fixture");

  console.log("=== Phronesis Vault Indexer ===\n");

  const config = loadVaultConfig();
  if (fixture) {
    console.log(`Loaded ${config.vaults.length} vault(s) from config\n`);
  }

  const vaults = await indexVaults(config);
  console.log(summarizeVaults(vaults));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
