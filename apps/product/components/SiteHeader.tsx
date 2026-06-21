"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [ticker, setTicker] = useState("085.44");

  useEffect(() => {
    const id = setInterval(() => {
      setTicker((85 + Math.random() * 2).toFixed(2));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          PHRONESIS
        </Link>
        <p className="header-tagline eyebrow">
          Architects of the programmable economy
        </p>
        <p className="header-ticker mono">
          [{ticker}] THE MARKET
        </p>
      </div>
      <div className="header-rule" />
    </header>
  );
}
