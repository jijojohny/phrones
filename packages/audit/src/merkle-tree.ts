import { createHash } from "node:crypto";

export class Sha256MerkleTree {
  private leaves: string[] = [];

  append(data: string | Buffer): string {
    const leaf = createHash("sha256").update(data).digest("hex");
    this.leaves.push(leaf);
    return `0x${leaf}`;
  }

  root(): string {
    if (this.leaves.length === 0) {
      return `0x${"0".repeat(64)}`;
    }
    let layer = [...this.leaves];
    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = layer[i + 1] ?? layer[i];
        next.push(createHash("sha256").update(left + right).digest("hex"));
      }
      layer = next;
    }
    return `0x${layer[0]}`;
  }

  leafCount(): number {
    return this.leaves.length;
  }
}
