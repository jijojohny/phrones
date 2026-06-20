import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phronesis Operator Dashboard",
  description: "Fund operator monitoring — feeds, vaults, relayer, NAV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
