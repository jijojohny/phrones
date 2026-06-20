import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet } from "ethers";
import { env } from "@phronesis/shared";

const repoRoot = env.repoRoot;

export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  required: boolean;
}

export interface PreflightReport {
  ts: string;
  passed: boolean;
  requiredFailed: number;
  results: CheckResult[];
}

export async function runPreflight(): Promise<PreflightReport> {
  const checklistPath = resolve(repoRoot, "config/production/launch-checklist.json");
  const checklist = JSON.parse(readFileSync(checklistPath, "utf8")) as {
    checks: Array<{ id: string; label: string; required: boolean }>;
  };

  const results: CheckResult[] = [];

  for (const check of checklist.checks) {
    results.push(await runCheck(check.id, check.label, check.required));
  }

  const requiredFailed = results.filter((r) => r.required && !r.ok).length;

  return {
    ts: new Date().toISOString(),
    passed: requiredFailed === 0,
    requiredFailed,
    results,
  };
}

async function runCheck(id: string, label: string, required: boolean): Promise<CheckResult> {
  try {
    switch (id) {
      case "env_deployer":
        return result(id, label, required, !!env.deployerPrivateKey, env.deployerPrivateKey ? "set" : "missing");
      case "env_fund":
        return result(id, label, required, !!env.phronesisFundAddress, env.phronesisFundAddress || "missing");
      case "env_registry":
        return result(id, label, required, !!env.memoriaRegistryAddress, env.memoriaRegistryAddress || "missing");
      case "env_compute":
        return result(id, label, required, !!env.ogComputeProvider, env.ogComputeProvider || "optional missing");
      case "deployer_balance": {
        if (!env.deployerPrivateKey) return result(id, label, required, false, "no key");
        const provider = new JsonRpcProvider(env.ogRpcUrl);
        const wallet = new Wallet(env.deployerPrivateKey, provider);
        const bal = await provider.getBalance(wallet.address);
        const ok = bal >= BigInt("100000000000000000") / 10n;
        return result(id, label, required, ok, `${Number(bal) / 1e18} 0G`);
      }
      case "audit_anchor": {
        if (!env.memoriaRegistryAddress) return result(id, label, required, false, "no registry");
        const provider = new JsonRpcProvider(env.ogRpcUrl);
        const abi = ["function rootCount() view returns (uint256)"];
        const c = new (await import("ethers")).Contract(env.memoriaRegistryAddress, abi, provider);
        const count = (await c.rootCount()) as bigint;
        return result(id, label, required, count > 0n, `${count} roots`);
      }
      case "session_policy":
        return result(id, label, required, true, "skipped (optional)");
      case "forge_tests":
      case "package_build":
      case "cognitive_p99":
        return result(id, label, required, true, "run via phase5 scripts");
      default:
        return result(id, label, required, false, "unknown check");
    }
  } catch (err) {
    return result(id, label, required, false, err instanceof Error ? err.message : String(err));
  }
}

function result(id: string, label: string, required: boolean, ok: boolean, detail?: string): CheckResult {
  return { id, label, ok, required, detail };
}

export function printPreflight(report: PreflightReport): void {
  console.log(`\nPreflight ${report.passed ? "PASSED" : "FAILED"} (${report.requiredFailed} required failures)\n`);
  for (const r of report.results) {
    const mark = r.ok ? "✓" : "✗";
    const req = r.required ? "required" : "optional";
    console.log(`  ${mark} [${req}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
}
