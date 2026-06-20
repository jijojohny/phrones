import { Contract, Wallet, keccak256, getBytes } from "ethers";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, requireDeployerKey } from "@phronesis/shared";
import { encodeProofForContract, processTransfer } from "./tee-oracle.js";

const ORACLE_ABI = [
  "function registerTransferProof(bytes32 proofHash, bytes32 oldDataHash, bytes32 newDataHash, bool receiverHasAccess) external",
];

const FUND_ABI = [
  "function transfer(address from, address to, uint256 tokenId, bytes sealedKey, bytes proof) external",
  "function clone(address to, uint256 tokenId, bytes sealedKey, bytes proof) external returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const action = args[0] ?? "transfer";
  const receiver = args.find((a) => a.startsWith("0x") && a.length === 42) ?? env.deployerAddress;
  const tokenId = Number(args.find((a) => /^\d+$/.test(a)) ?? "1");

  if (!receiver) {
    throw new Error("Receiver address required (-- 0x... or DEPLOYER_ADDRESS_TESTNET)");
  }

  const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
  const fixturePath = resolve(pkgRoot, "fixtures/encrypted-metadata.json");
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    ciphertext: string;
    iv: string;
    authTag: string;
  };

  const secret = env.fundEncryptionKey || "phronesis-dev-key-change-me";
  const decodeField = (v: string) => {
    if (/^[A-Za-z0-9+/=]+$/.test(v) && !v.startsWith("0x")) {
      return Buffer.from(v, "base64");
    }
    return Buffer.from(v.replace(/^0x/, ""), "hex");
  };

  const bundle = processTransfer(
    decodeField(raw.ciphertext),
    decodeField(raw.iv),
    decodeField(raw.authTag),
    { oldSecret: secret, receiverAddress: receiver, newEncryptedURI: "0g://phronesis/rotated" },
  );

  console.log("=== TEE Oracle Re-encryption ===\n");
  console.log(`Action:     ${action}`);
  console.log(`Old hash:   ${bundle.oldMetadataHash}`);
  console.log(`New hash:   ${bundle.newMetadataHash}`);
  console.log(`Sealed key: ${bundle.sealedKey.slice(0, 20)}…`);
  console.log(`Proof hash: ${bundle.proofHash}`);

  const outDir = resolve(pkgRoot, "fixtures");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "transfer-bundle.json"), JSON.stringify(bundle, null, 2));

  if (!env.phronesisOracleAddress || !env.phronesisFundAddress) {
    console.log("\nOracle/fund addresses not set — bundle saved to fixtures/transfer-bundle.json");
    return;
  }

  const { JsonRpcProvider } = await import("ethers");
  const provider = new JsonRpcProvider(env.ogRpcUrl, env.ogChainId);
  const wallet = new Wallet(requireDeployerKey(), provider);

  const oracle = new Contract(env.phronesisOracleAddress, ORACLE_ABI, wallet);
  const proof = encodeProofForContract(bundle);
  const proofHash = keccak256(getBytes(proof));
  const tx1 = await oracle.registerTransferProof(
    proofHash,
    bundle.oldMetadataHash,
    bundle.newMetadataHash,
    bundle.receiverHasAccess,
  );
  await tx1.wait();
  console.log(`\nRegistered proof on oracle: ${tx1.hash}`);

  const fund = new Contract(env.phronesisFundAddress, FUND_ABI, wallet);
  const sealedKey = bundle.sealedKey;

  if (action === "clone") {
    const tx2 = await fund.clone(receiver, tokenId, sealedKey, proof);
    const receipt = await tx2.wait();
    console.log(`Clone tx: ${receipt?.hash}`);
  } else {
    const from = await fund.ownerOf(tokenId);
    const tx2 = await fund.transfer(from, receiver, tokenId, sealedKey, proof);
    const receipt = await tx2.wait();
    console.log(`Transfer tx: ${receipt?.hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
