import { Portal } from "@/components/Portal";

export default function Page() {
  return (
    <main>
      <header>
        <h1>Phronesis Investor Portal</h1>
        <p>Connect wallet to view authorized fund performance and on-chain share balance</p>
      </header>
      <Portal />
    </main>
  );
}
