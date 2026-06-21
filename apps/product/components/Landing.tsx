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
    <main>
      <section className="card hero">
        <span className="badge">Galileo Testnet Beta</span>
        <h1 className="hero-title">{product?.name ?? "Phronesis"}</h1>
        <p className="hero-desc">
          {product?.description ??
            "Autonomous prediction-market fund on 0G. Deposit OG, own PHR shares, verify performance on-chain."}
        </p>
        <div className="btn-row">
          <Link href="/investor">
            <button type="button" className="btn-lg">Start as investor</button>
          </Link>
          <Link href="/operator">
            <button type="button" className="secondary btn-lg">Operator console</button>
          </Link>
        </div>
      </section>

      {product?.pillars && product.pillars.length > 0 && (
        <div className="grid-3">
          {product.pillars.map((p) => (
            <div key={p.title} className="pillar">
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h2 className="section-title">Beta flow</h2>
        <ol className="steps">
          <li className="step done">
            <span className="step-num">1</span>
            <div><strong>Investor</strong><p className="muted">Connect wallet → request access → deposit OG → view NAV</p></div>
          </li>
          <li className="step done">
            <span className="step-num">2</span>
            <div><strong>Operator</strong><p className="muted">Authorize beta testers → monitor fund + feed → run trading cycle</p></div>
          </li>
          <li className="step done">
            <span className="step-num">3</span>
            <div><strong>On-chain</strong><p className="muted">PhronesisFund + MemoriaRegistry on 0G · Polymarket execution on Polygon</p></div>
          </li>
        </ol>
      </section>

      <footer className="page-footer">
        Testnet beta only — not investment advice. Run locally: <code>pnpm product:start</code>
      </footer>
    </main>
  );
}
