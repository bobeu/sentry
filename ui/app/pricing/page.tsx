import Link from "next/link";
import { billingService } from "@/services/billing.service";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const pricing = await billingService.getPricing();
  const currency = pricing[0]?.currency ?? "USDm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/dashboard" className="text-sm text-[#9aa89a] hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Pricing
      </h1>
      <p className="mt-3 max-w-xl text-[#9aa89a]">
        Pay per completed work in {currency}. Work accrues as outstanding charges and settles
        on-chain in batches (monetary, action-count, or time thresholds).
      </p>
      <p className="mt-2 inline-flex rounded-full border border-[#35d07f]/30 bg-[#35d07f]/10 px-4 py-1 text-sm text-[#35d07f]">
        Payment Currency · {currency}
      </p>

      <ul className="mt-10 space-y-3">
        {pricing.map((row) => (
          <li
            key={row.type}
            className="flex items-center justify-between border-b border-white/10 py-4"
          >
            <span className="text-lg text-[#e8f5d8]">{row.label}</span>
            <span className="font-mono text-[#35d07f]">
              {row.amount} {row.currency}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
