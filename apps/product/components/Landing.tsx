"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProductConfig } from "@/lib/wallet";

export function Landing() {
  const [product, setProduct] = useState<ProductConfig | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setProduct(c.product as ProductConfig))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero-block">
        <p className="eyebrow">Galileo testnet beta · 0G deAIOS</p>
        <h1 className="hero-title">
          {product?.tagline ?? "Enterprise infrastructure for the programmable economy."}
        </h1>
        <p className="hero-desc">
          {product?.description ??
            "Autonomous prediction-market fund secured in TEE. Deposit OG, own fractional shares, verify every decision on-chain."}
        </p>
        <div className="btn-row">
          <Link href="/investor" className="btn-primary">
            Partner with us
          </Link>
          <Link href="/operator" className="btn-ghost">
            Operator console
          </Link>
        </div>
      </section>

      {product?.pillars && product.pillars.length > 0 && (
        <ul className="pillar-list">
          {product.pillars.map((p) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
      )}

      <section className="flow-section">
        <p className="eyebrow">How it works</p>
        <div className="flow-grid">
          <div className="flow-item">
            <p className="eyebrow">01</p>
            <strong>Invest</strong>
            <p>Connect wallet, request beta access, deposit OG, receive PHR shares pro-rata NAV.</p>
          </div>
          <div className="flow-item">
            <p className="eyebrow">02</p>
            <strong>Operate</strong>
            <p>Authorize testers, monitor fund health, review market divergence and audit roots.</p>
          </div>
          <div className="flow-item">
            <p className="eyebrow">03</p>
            <strong>Verify</strong>
            <p>PhronesisFund and MemoriaRegistry on 0G. Execution on Polygon via policy-gated Safe.</p>
          </div>
        </div>
      </section>

      <footer className="page-footer">
        Testnet beta only — not investment advice · Phronesis {new Date().getFullYear()}
      </footer>
    </>
  );
}
