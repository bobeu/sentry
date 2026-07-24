import { Suspense } from "react";
import Link from "next/link";
import { WalletsConsole } from "@/components/WalletsConsole";

export default function WalletsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-b border-primary/15 pb-5">
        <Link
          href="/dashboard"
          className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-black text-text-dark">Wallets</h1>
        <p className="mt-2 max-w-xl text-xs text-muted font-semibold leading-relaxed">
          Manage your employment prepaid wallet and per-group RewardAccounts in one place.
          Employment funds Sentry&apos;s work; RewardAccounts pay member cash prizes. See{" "}
          <Link href="/pricing" className="text-primary font-bold hover:underline">
            pricing
          </Link>
          .
        </p>
      </div>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted font-medium">Loading wallets…</p>
        }
      >
        <WalletsConsole />
      </Suspense>
    </main>
  );
}
