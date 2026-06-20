"use client";

import { useEffect, useState } from "react";
import type { OperatorStatus } from "@/lib/types";

export function Dashboard() {
  const [status, setStatus] = useState<OperatorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OperatorStatus;
        if (mounted) setStatus(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    const id = setInterval(load, 15_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return <p className="bad">Failed to load status: {error}</p>;
  }

  if (!status) {
    return <p className="stat-label">Loading operator status…</p>;
  }

  return (
    <>
      <div className="grid">
        <div className="card">
          <h2>Fund NAV</h2>
          <div className="stat">${status.fund.nav.toLocaleString()}</div>
          <div className="stat-label">
            {status.fund.totalAssets} native · {status.fund.shareSupply} shares
          </div>
        </div>
        <div className="card">
          <h2>Market Feed</h2>
          <div className="stat">{status.feed.marketCount}</div>
          <div className="stat-label">
            Top divergence {(status.feed.topDivergence * 100).toFixed(1)}% ·{" "}
            <span className={status.feed.healthy ? "ok" : "warn"}>
              {status.feed.healthy ? "healthy" : "degraded"}
            </span>
          </div>
        </div>
        <div className="card">
          <h2>Cross-chain Relayer</h2>
          <div className="stat">{status.relayer.pending}</div>
          <div className="stat-label">
            pending · {status.relayer.executed} executed ·{" "}
            <span className="badge dry">{status.relayer.mode}</span>
          </div>
        </div>
        <div className="card">
          <h2>ERC-7857 Agent</h2>
          <div className="stat">{status.agent.tokenId}</div>
          <div className="stat-label">
            hash {status.agent.metadataHash.slice(0, 14)}… · oracle{" "}
            {status.agent.oracleConfigured ? "✓" : "—"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Vault Adapters</h2>
        <table>
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Chain</th>
              <th>Share price</th>
              <th>Utilization</th>
              <th>Exposure</th>
            </tr>
          </thead>
          <tbody>
            {status.vaults.map((v) => (
              <tr key={`${v.protocol}-${v.vaultAddress}`}>
                <td>{v.protocol}</td>
                <td>{v.chainId}</td>
                <td>${v.sharePrice.toFixed(4)}</td>
                <td>{(v.utilization * 100).toFixed(0)}%</td>
                <td>
                  {Object.entries(v.strategyExposure)
                    .map(([k, n]) => `${k} ${(n * 100).toFixed(0)}%`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Top Divergence Markets</h2>
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>p_market</th>
              <th>p_sentiment</th>
              <th>Divergence</th>
            </tr>
          </thead>
          <tbody>
            {status.markets.slice(0, 8).map((m) => (
              <tr key={m.conditionId}>
                <td>{m.question.slice(0, 48)}…</td>
                <td>{(m.pMarket * 100).toFixed(1)}%</td>
                <td>{(m.pSentiment * 100).toFixed(1)}%</td>
                <td className={Math.abs(m.divergence) > 0.08 ? "warn" : ""}>
                  {(m.divergence * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer>
        Updated {new Date(status.ts).toLocaleString()} · fund {status.fund.address || "not deployed"} ·
        bridge {status.relayer.bridgeAddress || "not deployed"}
      </footer>
    </>
  );
}
