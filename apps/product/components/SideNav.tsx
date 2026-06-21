"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/investor", label: "Investor" },
  { href: "/operator", label: "Operator" },
];

export function SideNav() {
  const path = usePathname();

  return (
    <aside className="side-nav">
      <nav aria-label="Primary">
        <ul>
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={path === link.href || (link.href !== "/" && path.startsWith(link.href)) ? "active" : ""}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="side-nav-meta">
        <p className="eyebrow">Galileo testnet</p>
        <p className="side-note">Chain ID 16602 · 0G deAIOS</p>
      </div>
    </aside>
  );
}
