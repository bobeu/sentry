import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 hero-noise" />
      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#35d07f]/25 bg-[#35d07f]/10 px-3 py-1.5 text-xs font-medium tracking-wide text-[#9ff0c2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#35d07f] shadow-[0_0_12px_#35d07f]" />
            Telegram operations, on autopilot
          </div>
          <p className="mt-7 font-[family-name:var(--font-display)] text-6xl leading-[.82] tracking-tight text-[#f1faea] sm:text-8xl">
            {APP_NAME}
          </p>
          <h1 className="mt-7 max-w-2xl text-2xl font-medium leading-snug text-[#d7e6cf] sm:text-3xl">
            Your always-on AI teammate for thoughtful, well-run communities.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9aa89a] sm:text-lg">
            Sentry answers mentions, moderates spam, and reports on what matters—then
            settles only for completed work from a prepaid Celo wallet.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#35d07f] px-6 py-3 text-sm font-semibold text-[#061008] shadow-[0_12px_32px_rgba(53,208,127,.24)] transition hover:-translate-y-0.5 hover:bg-[#67e9a3]"
            >
              Hire Sentry
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/15 bg-white/[.035] px-6 py-3 text-sm text-[#e8f5d8] transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[.07]"
            >
              Open dashboard
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-8 -z-10 rounded-full bg-[#35d07f]/15 blur-3xl" />
          <div className="rounded-[2rem] border border-white/10 bg-[#0e1910]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-[#7d907d]">
                  Community pulse
                </p>
                <p className="mt-1 text-lg font-medium text-[#eef7e8]">
                  Sentry is working
                </p>
              </div>
              <span className="rounded-full bg-[#35d07f]/15 px-3 py-1 text-xs font-medium text-[#87efb1]">
                Live
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
                <p className="text-xs text-[#91a08f]">Mentions handled</p>
                <p className="mt-2 text-3xl font-semibold text-[#f1faea]">24</p>
                <p className="mt-1 text-xs text-[#68d895]">↑ 18% this week</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
                <p className="text-xs text-[#91a08f]">Groups protected</p>
                <p className="mt-2 text-3xl font-semibold text-[#f1faea]">08</p>
                <p className="mt-1 text-xs text-[#c7d6c4]">Always on</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-black/15 p-4 text-sm">
              <p className="flex items-center justify-between text-[#dce9d7]">
                <span>Answered a member mention</span>
                <span className="text-[#7d907d]">Now</span>
              </p>
              <p className="flex items-center justify-between text-[#dce9d7]">
                <span>Removed suspected spam</span>
                <span className="text-[#7d907d]">12m</span>
              </p>
              <p className="flex items-center justify-between text-[#dce9d7]">
                <span>Daily summary is queued</span>
                <span className="text-[#7d907d]">Today</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
