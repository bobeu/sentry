import { DashboardLive } from "@/components/DashboardLive";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
            Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-[#9aa89a]">
            Live employment and prepaid wallet balance. No mock values.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/groups" className="rounded-full border border-white/20 px-4 py-2">
            Groups
          </Link>
          <Link href="/employment" className="rounded-full border border-white/20 px-4 py-2">
            Employment
          </Link>
          <Link href="/wallet" className="rounded-full border border-white/20 px-4 py-2">
            Wallet
          </Link>
          <Link href="/settings" className="rounded-full border border-white/20 px-4 py-2">
            Settings
          </Link>
        </div>
      </div>
      <DashboardLive />
    </main>
  );
}
