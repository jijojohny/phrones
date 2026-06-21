"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProductNav() {
  const path = usePathname();

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        Phronesis
      </Link>
      <div className="nav-links">
        <Link href="/investor" className={path.startsWith("/investor") ? "active" : ""}>
          Investor
        </Link>
        <Link href="/operator" className={path.startsWith("/operator") ? "active" : ""}>
          Operator
        </Link>
        <span className="badge">Beta</span>
      </div>
    </nav>
  );
}
