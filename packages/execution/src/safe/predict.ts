import { getAddress, keccak256, solidityPacked } from "ethers";

/** Predict dev Safe placeholder from owner (not a deployed Safe — use for config only). */
export function predictSafeAddress(owner: string, salt = "phronesis-v1"): string {
  const hash = keccak256(solidityPacked(["address", "string"], [getAddress(owner), salt]));
  return getAddress(`0x${hash.slice(-40)}`);
}
