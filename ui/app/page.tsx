import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hero-plane"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hero-noise" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full lg:w-[58%] hero-glow" />

      <section className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col justify-end px-6 pb-16 pt-24 sm:pb-20 sm:pt-28 lg:justify-center lg:pb-24">
        <p className="font-[family-name:var(--font-display)] text-[clamp(4.5rem,16vw,9.5rem)] leading-[0.82] tracking-[-0.04em] text-[#f4fbe9] animate-rise">
          {APP_NAME}
        </p>
        <h1 className="mt-8 max-w-2xl text-2xl font-medium leading-snug text-[#d8e8cf] sm:text-3xl animate-rise-delay">
          An AI employee for Telegram communities, paid from a prepaid Celo wallet.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9aa89a] sm:text-lg animate-rise-delay-2">
          Mentions, moderation, and summaries—settled only for completed work.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 animate-rise-delay-3">
          <Link
            href="/login"
            className="rounded-full bg-[#35d07f] px-7 py-3.5 text-sm font-semibold text-[#061008] transition duration-300 hover:-translate-y-0.5 hover:bg-[#67e9a3]"
          >
            Hire Sentry
          </Link>
          <Link
            href="/docs"
            className="rounded-full border border-white/20 px-7 py-3.5 text-sm text-[#e8f5d8] transition duration-300 hover:-translate-y-0.5 hover:border-white/40"
          >
            How it works
          </Link>
        </div>
      </section>
    </main>
  );
}
