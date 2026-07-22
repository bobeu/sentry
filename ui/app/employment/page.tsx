import { EmploymentPanel } from "@/components/EmploymentPanel";
import Link from "next/link";

export default function EmploymentPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="border-b border-primary/15 pb-5">
        <Link href="/dashboard" className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-black text-text-dark">
          Employment
        </h1>
        <p className="mt-2 max-w-xl text-xs text-muted font-semibold leading-relaxed">
          Hire Sentry after reviewing and accepting the Employment Agreement. Rejecting
          cancels hire — no wallet or employment action is taken. Pause and resume anytime
          without losing prepaid balance.
        </p>
      </div>
      <EmploymentPanel />
    </main>
  );
}

