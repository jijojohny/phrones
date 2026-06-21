"use client";

import { useCallback, useEffect, useState } from "react";
import type { PerformanceReport } from "@phronesis/shared";

interface Config {
  fundAddress: string;
  shareAddress: string;
  oracleAddress: string;
  memoriaRegistry: string;
  executorUrl: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  stablecoins: { symbol: string; decimals: number; address: string; native?: boolean }[];
}

interface AuditEntry {
  merkleRoot: string;
  storageHash: string;
  ts: number;
  registryAddress: string;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export function Portal() {
  const [config, setConfig] = useState<Config | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [audit, setAudit] = useState<AuditEntry | null>(null);
  const [shareBalance, setShareBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Failed to load config"));

    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => a && setAudit(a as AuditEntry))
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("No wallet detected — install MetaMask or Rabby");
      return;
    }
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    setAddress(accounts[0] ?? null);
  }, []);

  const loadPerformance = useCallback(async () => {
    if (!address || !config) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance?investor=${address}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setReport((await res.json()) as PerformanceReport);

      const balRes = await fetch(`/api/shares?address=${address}`);
      if (balRes.ok) {
        const bal = (await balRes.json()) as { balance: string };
        setShareBalance(bal.balance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [address, config]);

  useEffect(() => {
    if (address) loadPerformance();
  }, [address, loadPerformance]);

  const auditMatch =
    report?.lastAuditRoot &&
    audit?.merkleRoot &&
    report.lastAuditRoot.toLowerCase() === audit.merkleRoot.toLowerCase();

  return (
    <>
      <section className="card">
        {!address ? (
          <button type="button" onClick={connect}>
            Connect wallet
          </button>
        ) : (
          <>
            <p className="addr">{address}</p>
            <button type="button" className="secondary" onClick={loadPerformance} disabled={loading}>
              {loading ? "Loading…" : "Refresh performance"}
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
        {error?.includes("not authorized") && (
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            Ask the fund owner to run:{" "}
            <code>pnpm phase4:authorize --investor={address?.slice(0, 10)}…</code>
          </p>
        )}
      </section>

      {report && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1rem", color: "var(--muted)" }}>Performance</h2>
          <div className="grid">
            <div className="metric">
              <span>NAV</span>
              <strong>${report.nav.toLocaleString()}</strong>
            </div>
            <div className="metric">
              <span>NAV / share</span>
              <strong>{report.navPerShare.toFixed(4)} OG</strong>
            </div>
            <div className="metric">
              <span>30d PnL</span>
              <strong>{(report.pnl30d * 100).toFixed(2)}%</strong>
            </div>
            <div className="metric">
              <span>Sharpe</span>
              <strong>{report.sharpe.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>Max drawdown</span>
              <strong>{(report.maxDrawdown * 100).toFixed(1)}%</strong>
            </div>
            <div className="metric">
              <span>Audit verified</span>
              <strong className={report.auditVerified ? "ok" : ""}>
                {report.auditVerified ? "Yes" : "No"}
              </strong>
            </div>
          </div>
          {shareBalance !== null && (
            <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
              Your shares: <strong style={{ color: "var(--text)" }}>{shareBalance}</strong>
            </p>
          )}
        </section>
      )}

      {audit && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1rem", color: "var(--muted)" }}>Memoria audit root</h2>
          <p className="addr" style={{ wordBreak: "break-all" }}>
            {audit.merkleRoot}
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Anchored {new Date(audit.ts).toLocaleString()}
            {auditMatch !== undefined && (
              <> · Registry match: {auditMatch ? "✓" : "—"}</>
            )}
          </p>
        </section>
      )}

      {config && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1rem", color: "var(--muted)" }}>On-chain</h2>
          <p className="addr">Fund: {config.fundAddress || "—"}</p>
          <p className="addr">Share: {config.shareAddress || "—"}</p>
          <p className="addr">Registry: {config.memoriaRegistry || "—"}</p>
          {config.fundAddress && (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.75rem" }}>
              Deposit native OG or allowlisted stablecoins:
            </p>
          )}
          {config.stablecoins?.length > 0 && (
            <ul style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.5rem 0 0 1rem" }}>
              {config.stablecoins.map((t) => (
                <li key={t.symbol}>
                  <strong style={{ color: "var(--text)" }}>{t.symbol}</strong>
                  {t.native ? " (native)" : t.address ? ` · ${t.address.slice(0, 10)}…` : " · configure in .env"}
                  {" — "}
                  <code>
                    pnpm phase4:deposit --amount=100 --token={t.symbol}
                  </code>
                </li>
              ))}
            </ul>
          )}
          {config.fundAddress && config.explorerUrl && (
            <p>
              <a
                href={`${config.explorerUrl}/address/${config.fundAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                View fund on explorer →
              </a>
            </p>
          )}
        </section>
      )}
    </>
  );
}
