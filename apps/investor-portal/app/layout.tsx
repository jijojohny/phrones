import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phronesis Investor Portal",
  description: "ERC-7857 fractional fund — NAV, yield, and authorized performance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
