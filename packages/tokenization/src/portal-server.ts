import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { env } from "@phronesis/shared";

const pkgRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export function startPortalServer(port = env.investorPortalPort): void {
  const html = readFileSync(resolve(pkgRoot, "public/index.html"), "utf8");

  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (url === "/config.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          fundAddress: env.phronesisFundAddress || "",
          shareAddress: env.phronesisShareAddress || "",
          oracleAddress: env.phronesisOracleAddress || "",
          memoriaRegistry: env.memoriaRegistryAddress || "",
          executorUrl: `http://localhost:${env.sealedExecutorPort}`,
          rpcUrl: env.ogRpcUrl,
          chainId: env.ogChainId,
          explorerUrl: env.ogExplorerUrl || "https://chainscan-galileo.0g.ai",
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`[investor-portal] http://localhost:${port}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  startPortalServer();
}
