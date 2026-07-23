import { DashboardLive } from "@/components/DashboardLive";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-primary/15 pb-5">
        <div>
          <h1 className="text-3xl font-black text-text-dark">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-xs text-muted font-semibold">
            Live employment and prepaid wallet balance. No mock values.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/groups" className="rounded-full border border-primary/20 bg-white px-4 py-2 font-bold text-text-dark hover:border-primary hover:text-primary transition shadow-sm">
            Groups
          </Link>
          <Link href="/employment" className="rounded-full border border-primary/20 bg-white px-4 py-2 font-bold text-text-dark hover:border-primary hover:text-primary transition shadow-sm">
            Employment
          </Link>
          <Link href="/wallet" className="rounded-full border border-primary/20 bg-white px-4 py-2 font-bold text-text-dark hover:border-primary hover:text-primary transition shadow-sm">
            Wallet
          </Link>
          <Link href="/settings" className="rounded-full border border-primary/20 bg-white px-4 py-2 font-bold text-text-dark hover:border-primary hover:text-primary transition shadow-sm">
            Settings
          </Link>
        </div>
      </div>
      <DashboardLive />
    </main>
  );
}

