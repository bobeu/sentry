import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-6 py-16">
        <div className="pointer-events-none absolute inset-y-0 right-[-8%] hidden w-[55%] bg-[url('/hero-grid.svg')] bg-cover bg-right opacity-40 lg:block" />

        <p className="font-[family-name:var(--font-display)] text-5xl leading-none text-[#e8f5d8] sm:text-7xl">
          {APP_NAME}
        </p>
        <h1 className="mt-6 max-w-2xl text-2xl leading-snug text-[#d7e6cf] sm:text-3xl">
          An AI employee for Telegram communities — hired, prepaid, and paid only for
          completed work.
        </h1>
        <p className="mt-5 max-w-xl text-base text-[#9aa89a] sm:text-lg">
          Monitor chats, answer mentions, moderate spam, and deliver reports while
          charging from an on-chain wallet on Celo.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-[#35d07f] px-6 py-3 text-sm font-semibold text-[#061008] transition hover:bg-[#4ae08f]"
          >
            Hire Sentry
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/20 px-6 py-3 text-sm text-[#e8f5d8] transition hover:border-white/40"
          >
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
