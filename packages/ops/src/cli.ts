#!/usr/bin/env node
import { printComplianceMemo } from "./compliance.js";
import { printLoadReport, runCognitiveLoadTest } from "./load-test.js";
import { printPreflight, runPreflight } from "./preflight.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
const cmd = args[0] ?? "preflight";

async function main() {
  switch (cmd) {
    case "preflight": {
      const report = await runPreflight();
      printPreflight(report);
      process.exit(report.passed ? 0 : 1);
      break;
    }
    case "load-test": {
      const iterations = Number(args.find((a) => a.startsWith("--iterations="))?.split("=")[1] ?? 50);
      const report = await runCognitiveLoadTest(iterations);
      printLoadReport(report);
      process.exit(report.passed ? 0 : 1);
      break;
    }
    case "compliance":
      printComplianceMemo();
      break;
    case "health": {
      const report = await runPreflight();
      printPreflight(report);
      break;
    }
    default:
      console.log(`Phronesis ops CLI

Commands:
  preflight     Run production launch checklist
  load-test     Benchmark cognitive cycle latency (p99 < 5s)
  compliance    Print go/no-go compliance memo
  health        Alias for preflight
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
