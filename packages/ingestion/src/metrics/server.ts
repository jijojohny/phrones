import { createServer } from "node:http";
import type { FeedHealthMetrics } from "@phronesis/shared";
import { formatPrometheus } from "./feed-health.js";

export interface MetricsServer {
  update(metrics: FeedHealthMetrics): void;
  close(): void;
}

export function startMetricsServer(port: number): MetricsServer {
  let latest: FeedHealthMetrics | null = null;

  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ts: latest?.ts ?? null }));
      return;
    }

    if (url === "/metrics" || url === "/") {
      if (!latest) {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("no metrics yet\n");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(formatPrometheus(latest));
      return;
    }

    res.writeHead(404);
    res.end("not found\n");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[metrics] port ${port} in use — metrics disabled`);
    } else {
      console.warn("[metrics] server error:", err.message);
    }
  });

  server.listen(port, () => {
    console.log(`[metrics] http://localhost:${port}/metrics`);
  });

  return {
    update(metrics: FeedHealthMetrics) {
      latest = metrics;
    },
    close() {
      server.close();
    },
  };
}
