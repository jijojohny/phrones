import type { Metadata } from "next";
import "./globals.css";
import { ProductNav } from "@/components/ProductNav";

export const metadata: Metadata = {
  title: "Phronesis — Autonomous Prediction-Market Fund",
  description: "Beta product: investor portal + operator console on 0G Galileo testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProductNav />
        {children}
      </body>
    </html>
  );
}
