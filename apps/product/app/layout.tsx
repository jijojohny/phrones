import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ChainGraphic } from "@/components/ChainGraphic";
import { SideNav } from "@/components/SideNav";
import { SiteHeader } from "@/components/SiteHeader";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Phronesis — Autonomous Prediction-Market Fund",
  description: "Enterprise infrastructure for autonomous prediction-market capital on 0G",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${plexMono.variable}`}>
      <body>
        <div className="grain" aria-hidden="true" />
        <SiteHeader />
        <div className="page-wrap">
          <div className="page-content">{children}</div>
          <SideNav />
        </div>
        <ChainGraphic />
      </body>
    </html>
  );
}
