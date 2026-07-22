import Link from "next/link";
import { billingService } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const pricing = await billingService.getPricing();
  const currency = pricing[0]?.currency ?? "USDm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 space-y-8">
      <div className="border-b border-primary/15 pb-5">
        <Link href="/dashboard" className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-black text-text-dark">
          Pricing Console
        </h1>
        <p className="mt-1.5 text-xs text-muted font-semibold leading-relaxed">
          Accrue small prepaid fees per resolved action. Billing settles on-chain automatically when thresholds are reached.
        </p>
      </div>

      <div className="surface-card p-6 space-y-6 border border-primary/10 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary/10 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Billing Currency</span>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold uppercase font-mono">
            {currency} Network Settled
          </span>
        </div>

        <ul className="space-y-1">
          {pricing.map((row) => (
            <li
              key={row.type}
              className="flex items-center justify-between border-b border-primary/5 py-4 last:border-b-0 hover:bg-primary/5 px-2 rounded-xl transition"
            >
              <span className="text-sm font-bold text-text-dark">{row.label}</span>
              <span className="font-mono text-xs font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
                {row.amount} {row.currency}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

