import { createServer } from "node:http";
import type { AttestationQuote } from "@phronesis/shared";
import { fetchAttestationQuote, verifyAttestationQuote } from "./verify.js";

export interface AttestationServer {
  close(): void;
}

export function startAttestationServer(port: number): AttestationServer {
  let latest: AttestationQuote | null = null;

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ts: latest?.ts ?? null }));
      return;
    }

    if (url === "/attestation/verify" || url === "/attestation") {
      try {
        latest = await fetchAttestationQuote();
        const valid = verifyAttestationQuote(latest);
        res.writeHead(valid ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...latest, valid }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    if (url === "/attestation/latest") {
      res.writeHead(latest ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify(latest ?? { error: "no quote yet" }));
      return;
    }

    res.writeHead(404);
    res.end("not found\n");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[attestation] port ${port} in use`);
    }
  });

  server.listen(port, () => {
    console.log(`[attestation] http://localhost:${port}/attestation/verify`);
  });

  return {
    close() {
      server.close();
    },
  };
}
