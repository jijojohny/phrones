"use client";

import { useCallback, useEffect, useState } from "react";
import { shortenAddress } from "@/lib/wallet";
import type { OperatorStatus } from "@/lib/types";

export function OperatorConsole() {
  const [status, setStatus] = useState<OperatorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operatorSecret, setOperatorSecret] = useState("");
  const [authorizing, setAuthorizing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus((await res.json()) as OperatorStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const authorize = async (investor: string) => {
    setAuthorizing(investor);
    setActionMsg(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (operatorSecret) headers["x-operator-secret"] = operatorSecret;
      const res = await fetch("/api/operator/authorize", {
        method: "POST",
        headers,
        body: JSON.stringify({ investor, days: 30 }),
      });
      const body = (await res.json()) as { error?: string; txHash?: string };
      if (!res.ok) throw new Error(body.error ?? "Authorize failed");
      setActionMsg(`Authorized ${shortenAddress(investor)} — tx ${body.txHash?.slice(0, 14)}…`);
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthorizing(null);
    }
  };

  if (error) {
    return (
      <section className="panel">
        <p className="bad">Failed to load: {error}</p>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel">
        <p className="muted">Loading operator console…</p>
      </section>
    );
  }

  return (
    <>
      <header className="page-intro">
        <span className="badge">Operator</span>
        <h1>Fund control center</h1>
        <p>Monitor fund health, authorize beta testers, review market feed</p>
      </header>

      <div className="panel-stack">
        <section className="panel">
          <h2 className="section-title">Operator auth</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Set <code className="mono">OPERATOR_API_SECRET</code> in .env for production. Dev mode allows without secret.
          </p>
          <input
            type="password"
            placeholder="x-operator-secret (optional in dev)"
            value={operatorSecret}
            onChange={(e) => setOperatorSecret(e.target.value)}
            className="input"
          />
          {actionMsg && <p className={actionMsg.startsWith("Authorized") ? "ok" : "error"}>{actionMsg}</p>}
        </section>

        <div className="stat-grid">
          <div className="stat-cell">
            <h2 className="section-title">Fund NAV</h2>
            <div className="stat">${status.fund.nav.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="stat-label">{status.fund.totalAssetsOg} OG · {status.fund.shareSupply} PHR</div>
            <div className="stat-label">NAV/share {status.fund.navPerShare.toFixed(4)}</div>
          </div>
          <div className="stat-cell">
            <h2 className="section-title">Market feed</h2>
            <div className="stat">{status.feed.marketCount}</div>
            <div className="stat-label">
              Top divergence {(status.feed.topDivergence * 100).toFixed(1)}% ·{" "}
              <span className={status.feed.healthy ? "ok" : "warn"}>{status.feed.healthy ? "healthy" : "degraded"}</span>
            </div>
          </div>
          <div className="stat-cell">
            <h2 className="section-title">Relayer</h2>
            <div className="stat">{status.relayer.pending}</div>
            <div className="stat-label">pending · mode {status.relayer.mode}</div>
          </div>
          <div className="stat-cell">
            <h2 className="section-title">Compliance</h2>
            <div className="stat">{status.compliance.blockers}</div>
            <div className="stat-label">blockers · {status.compliance.jurisdiction}</div>
          </div>
        </div>

        <section className="panel">
          <h2 className="section-title">Launch preflight</h2>
          <ul className="steps">
            {status.preflight.checks.map((c) => (
              <li key={c.label} className={`step ${c.ok ? "done" : ""}`}>
                <span className="step-num">{c.ok ? "✓" : "!"}</span>
                <div>
                  <strong>{c.label}</strong>
                  <p>{c.detail}{c.required ? " · required" : " · optional"}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted">{status.preflight.passed ? "Preflight passed" : "Preflight has required failures"}</p>
        </section>

        <section className="panel">
          <h2 className="section-title">Beta access requests</h2>
          {status.betaRequests.length === 0 ? (
            <p className="muted">No requests yet — investors submit from /investor</p>
          ) : (
            <table>
              <thead>
                <tr><th>Wallet</th><th>Email</th><th>When</th><th></th></tr>
              </thead>
              <tbody>
                {status.betaRequests.map((r) => (
                  <tr key={`${r.address}-${r.ts}`}>
                    <td className="mono">{shortenAddress(r.address, 8)}</td>
                    <td>{r.email ?? "—"}</td>
                    <td>{new Date(r.ts).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={authorizing === r.address}
                        onClick={() => authorize(r.address)}
                      >
                        {authorizing === r.address ? "…" : "Authorize"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Top divergence markets</h2>
          <table>
            <thead>
              <tr><th>Market</th><th>p_mkt</th><th>p_sent</th><th>Δ</th></tr>
            </thead>
            <tbody>
              {status.markets.slice(0, 8).map((m) => (
                <tr key={m.conditionId}>
                  <td>{m.question.slice(0, 48)}…</td>
                  <td>{(m.pMarket * 100).toFixed(1)}%</td>
                  <td>{(m.pSentiment * 100).toFixed(1)}%</td>
                  <td className={Math.abs(m.divergence) > 0.08 ? "warn" : ""}>{(m.divergence * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2 className="section-title">Vault adapters</h2>
          <table>
            <thead>
              <tr><th>Protocol</th><th>Chain</th><th>Share price</th><th>Util</th></tr>
            </thead>
            <tbody>
              {status.vaults.map((v) => (
                <tr key={`${v.protocol}-${v.vaultAddress}`}>
                  <td>{v.protocol}</td>
                  <td>{v.chainId}</td>
                  <td>${v.sharePrice.toFixed(4)}</td>
                  <td>{(v.utilization * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="page-footer">
          Updated {new Date(status.ts).toLocaleString()} · fund{" "}
          {status.fund.address ? shortenAddress(status.fund.address) : "not deployed"}
        </footer>
      </div>
    </>
  );
}
