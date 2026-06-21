"use client";

import { useCallback, useEffect, useState } from "react";
import type { PerformanceReport } from "@phronesis/shared";
import {
  depositErc20,
  depositNative,
  redeemErc20,
  redeemNative,
} from "@/lib/fund-actions";
import {
  connectWallet,
  getChainId,
  shortenAddress,
  switchToNetwork,
  type PortalConfig,
} from "@/lib/wallet";

interface AuditEntry {
  merkleRoot: string;
  storageHash: string;
  ts: number;
}

export function BetaApp() {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [audit, setAudit] = useState<AuditEntry | null>(null);
  const [shareBalance, setShareBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [depositToken, setDepositToken] = useState("OG");
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemShares, setRedeemShares] = useState("");
  const [txPending, setTxPending] = useState(false);
  const [txMessage, setTxMessage] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: PortalConfig) => {
        setConfig(c);
        setDepositAmount(c.beta?.defaultDepositOg ?? "0.1");
      })
      .catch(() => setError("Failed to load config"));
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => a && setAudit(a as AuditEntry))
      .catch(() => {});
  }, []);

  const refreshChain = useCallback(async () => {
    if (!config) return false;
    try {
      const ok = (await getChainId()) === config.chainId;
      setChainOk(ok);
      return ok;
    } catch {
      setChainOk(false);
      return false;
    }
  }, [config]);

  const refreshAuth = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/auth?address=${address}`);
    if (res.ok) setAuthorized(((await res.json()) as { authorized: boolean }).authorized);
  }, [address]);

  const refreshShares = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/shares?address=${address}`);
    if (res.ok) setShareBalance(((await res.json()) as { balance: string }).balance);
  }, [address]);

  const loadPerformance = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance?investor=${address}`);
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setReport((await res.json()) as PerformanceReport);
      await refreshShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [address, refreshShares]);

  useEffect(() => {
    if (address) {
      refreshChain();
      refreshAuth();
      refreshShares();
    }
  }, [address, refreshChain, refreshAuth, refreshShares]);

  useEffect(() => {
    if (address && authorized && chainOk) loadPerformance();
  }, [address, authorized, chainOk, loadPerformance]);

  const handleConnect = async () => {
    setError(null);
    try {
      setAddress(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSwitchNetwork = async () => {
    if (!config) return;
    setError(null);
    try {
      await switchToNetwork(config.network, config.rpcUrl);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRequestAccess = async () => {
    if (!address) return;
    setError(null);
    try {
      const res = await fetch("/api/beta/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, email: accessEmail || undefined }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Request failed");
      setAccessRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeposit = async () => {
    if (!config?.fundAddress || !depositAmount) return;
    setTxPending(true);
    setTxMessage("");
    setError(null);
    try {
      const token = config.stablecoins.find((t) => t.symbol === depositToken);
      if (!token) throw new Error("Unknown token");
      const result = token.native
        ? await depositNative(config.fundAddress, depositAmount)
        : await depositErc20(config.fundAddress, token.address, depositAmount, token.decimals);
      setTxMessage(`Deposited — tx ${shortenAddress(result.txHash, 8)}`);
      await refreshShares();
      if (authorized) await loadPerformance();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTxPending(false);
    }
  };

  const handleRedeem = async () => {
    if (!config?.fundAddress || !redeemShares) return;
    setTxPending(true);
    setTxMessage("");
    setError(null);
    try {
      const token = config.stablecoins.find((t) => t.symbol === depositToken);
      if (!token) throw new Error("Unknown token");
      const result = token.native
        ? await redeemNative(config.fundAddress, redeemShares)
        : await redeemErc20(config.fundAddress, token.address, redeemShares);
      setTxMessage(`Redeemed — tx ${shortenAddress(result.txHash, 8)}`);
      await refreshShares();
      if (authorized) await loadPerformance();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTxPending(false);
    }
  };

  if (!config) {
    return (
      <section className="panel">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  const auditMatch =
    report?.lastAuditRoot && audit?.merkleRoot &&
    report.lastAuditRoot.toLowerCase() === audit.merkleRoot.toLowerCase();

  return (
    <>
      <header className="page-intro">
        <span className="badge">{config.beta.label}</span>
        <h1>Investor portal</h1>
        <p>{config.beta.tagline}</p>
      </header>

      <div className="panel-stack">
        <section className="panel">
          <h2 className="section-title">Onboarding</h2>
          <ol className="steps">
            {config.beta.onboarding.map((s, i) => (
              <li key={s.id} className="step">
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h2 className="section-title">Wallet</h2>
          {!address ? (
            <button type="button" className="btn-primary" onClick={handleConnect}>
              Connect wallet
            </button>
          ) : (
            <div className="wallet-bar">
              <span className="mono">{shortenAddress(address)}</span>
              {!chainOk && (
                <button type="button" className="secondary" onClick={handleSwitchNetwork}>
                  Switch to {config.network.name}
                </button>
              )}
              {chainOk && <span className="ok-pill">{config.network.nativeCurrency.symbol} testnet</span>}
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        {address && chainOk && authorized === false && config.beta.features.requestAccess && (
          <section className="panel">
            <h2 className="section-title">Request beta access</h2>
            <p className="muted">Performance data requires operator authorization.</p>
            {!accessRequested ? (
              <>
                <input
                  type="email"
                  placeholder="Your email (optional)"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  className="input"
                />
                <div className="btn-row">
                  <button type="button" onClick={handleRequestAccess}>Request access</button>
                </div>
              </>
            ) : (
              <p className="ok">Request submitted. Operator will authorize your wallet.</p>
            )}
            <button type="button" className="secondary" onClick={refreshAuth} style={{ marginTop: "0.75rem" }}>
              Check authorization
            </button>
          </section>
        )}

        {address && chainOk && config.fundAddress && config.beta.features.deposit && (
          <section className="panel">
            <h2 className="section-title">Deposit & redeem</h2>
            <div className="form-row">
              <label>
                Token
                <select value={depositToken} onChange={(e) => setDepositToken(e.target.value)} className="input">
                  {config.stablecoins.map((t) => (
                    <option key={t.symbol} value={t.symbol} disabled={!t.native && !t.address}>
                      {t.symbol}{!t.native && !t.address ? " (N/A)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row two-col">
              <label>
                Deposit amount
                <input type="text" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="input" />
              </label>
              <label>
                Redeem shares
                <input type="text" value={redeemShares} onChange={(e) => setRedeemShares(e.target.value)} placeholder="1.0" className="input" />
              </label>
            </div>
            <div className="btn-row">
              <button type="button" onClick={handleDeposit} disabled={txPending || !depositAmount}>
                {txPending ? "Confirm in wallet…" : "Deposit"}
              </button>
              <button type="button" className="secondary" onClick={handleRedeem} disabled={txPending || !redeemShares}>
                Redeem
              </button>
            </div>
            {shareBalance !== null && (
              <p className="muted" style={{ marginTop: "1rem" }}>
                Your shares: <strong>{shareBalance} PHR</strong>
              </p>
            )}
            {txMessage && <p className="ok">{txMessage}</p>}
            {config.network.faucetUrl && (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Need testnet OG? <a href={config.network.faucetUrl} target="_blank" rel="noreferrer">Faucet →</a>
              </p>
            )}
          </section>
        )}

        {authorized && report && (
          <section className="panel">
            <div className="section-header">
              <h2 className="section-title" style={{ margin: 0 }}>Performance</h2>
              <button type="button" className="secondary" onClick={loadPerformance} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="grid">
              <div className="metric"><span>NAV</span><strong>${report.nav.toLocaleString()}</strong></div>
              <div className="metric"><span>NAV / share</span><strong>{report.navPerShare.toFixed(4)} OG</strong></div>
              <div className="metric"><span>30d PnL</span><strong>{(report.pnl30d * 100).toFixed(2)}%</strong></div>
              <div className="metric"><span>Sharpe</span><strong>{report.sharpe.toFixed(2)}</strong></div>
              <div className="metric"><span>Max drawdown</span><strong>{(report.maxDrawdown * 100).toFixed(1)}%</strong></div>
              <div className="metric">
                <span>Audit</span>
                <strong className={report.auditVerified ? "ok" : ""}>{report.auditVerified ? "Verified" : "Pending"}</strong>
              </div>
            </div>
            <p className="beta-note">Beta: PnL/Sharpe may be stubbed until live trading feeds in.</p>
          </section>
        )}

        {audit && (
          <section className="panel">
            <h2 className="section-title">Memoria audit root</h2>
            <p className="mono break-all">{audit.merkleRoot}</p>
            <p className="muted">
              Anchored {new Date(audit.ts).toLocaleString()}
              {auditMatch !== undefined && <> · Match: {auditMatch ? "✓" : "—"}</>}
            </p>
          </section>
        )}

        <section className="panel-muted">
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{config.beta.disclaimer}</p>
        </section>
      </div>
    </>
  );
}
