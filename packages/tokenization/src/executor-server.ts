import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { env } from "@phronesis/shared";
import { fetchLatestAudit, verifyAuditRoot } from "./audit.js";
import { buildPerformanceReport } from "./performance.js";

export function startExecutorServer(port = env.sealedExecutorPort): void {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      json(res, 200, { ok: true, fund: env.phronesisFundAddress || null });
      return;
    }

    if (url.pathname === "/performance") {
      const investor = url.searchParams.get("investor");
      if (!investor) {
        json(res, 400, { error: "Missing investor query param" });
        return;
      }

      try {
        const report = await buildPerformanceReport(investor);
        json(res, 200, report);
      } catch (err) {
        json(res, 403, {
          error: err instanceof Error ? err.message : "Forbidden",
        });
      }
      return;
    }

    if (url.pathname === "/audit/latest") {
      const latest = await fetchLatestAudit();
      if (!latest) {
        json(res, 404, { error: "No audit roots anchored" });
        return;
      }
      json(res, 200, latest);
      return;
    }

    if (url.pathname === "/audit/verify") {
      const root = url.searchParams.get("root");
      if (!root) {
        json(res, 400, { error: "Missing root query param" });
        return;
      }
      const ok = await verifyAuditRoot(root);
      json(res, 200, { root, verified: ok });
      return;
    }

    json(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`[sealed-executor] http://localhost:${port}`);
    console.log(`  GET /performance?investor=0x...`);
    console.log(`  GET /audit/latest`);
    console.log(`  GET /audit/verify?root=0x...`);
    console.log(`  GET /health`);
  });
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  startExecutorServer();
}
