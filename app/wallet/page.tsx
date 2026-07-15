import { WalletPanel } from "@/components/EmploymentWalletPanels";
import Link from "next/link";

export default function WalletPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href="/dashboard" className="text-sm text-[#9aa89a] hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Wallet
      </h1>
      <p className="mt-3 max-w-xl text-[#9aa89a]">
        Your employment smart wallet is provisioned when you hire Sentry. Address and
        prepaid balance only — no private keys.
      </p>
      <WalletPanel />
    </main>
  );
}
