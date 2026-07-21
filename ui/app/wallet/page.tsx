import { WalletPanel } from "@/components/EmploymentWalletPanels";
import Link from "next/link";

export default function WalletPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="border-b border-primary/15 pb-5">
        <Link href="/dashboard" className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-black text-text-dark">
          Wallet
        </h1>
        <p className="mt-2 max-w-xl text-xs text-muted font-semibold leading-relaxed">
          Your manager-controlled prepaid wallet has one immutable currency. Set a separate
          withdrawal destination for payouts; users never hold wallet contract keys. See{" "}
          <Link href="/pricing" className="text-primary font-bold hover:underline">
            pricing
          </Link>
          .
        </p>
      </div>
      <WalletPanel />
    </main>
  );
}

