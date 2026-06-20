import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";

export function printComplianceMemo(): void {
  const path = resolve(env.repoRoot, "config/compliance/go-no-go.json");
  const memo = JSON.parse(readFileSync(path, "utf8")) as {
    title: string;
    jurisdiction: string;
    items: Array<{ id: string; label: string; status: string; required: boolean }>;
  };

  console.log(`\n${memo.title}`);
  console.log(`Jurisdiction: ${memo.jurisdiction}\n`);

  let blockers = 0;
  for (const item of memo.items) {
    const mark = item.status === "complete" ? "✓" : "○";
    console.log(`  ${mark} [${item.status}] ${item.label}`);
    if (item.required && item.status !== "complete") blockers += 1;
  }

  console.log(`\nRequired items pending: ${blockers}`);
  console.log(blockers === 0 ? "GO for production launch" : "NO-GO until blockers resolved\n");
}
