"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PAYMENT_CURRENCIES } from "@/lib/payment-currency";

export default function AdminPaymentPage() {
  const [currency, setCurrency] = useState("USDm");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/payment/currency");
      if (res.ok) {
        const json = await res.json();
        setCurrency(json.currency ?? "USDm");
      }
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/payment/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage(`Payment currency updated to ${json.currency}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <Link href="/dashboard" className="text-sm text-[#9aa89a] hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Admin · Payment Currency
      </h1>
      <p className="mt-3 text-sm text-[#9aa89a]">
        Global payment currency for all users. Requires ADMIN_EMAILS.
      </p>

      <form onSubmit={save} className="mt-8 space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-sm text-[#9aa89a]">Payment Currency</legend>
          {PAYMENT_CURRENCIES.map((c) => (
            <label key={c} className="flex items-center gap-3 text-[#e8f5d8]">
              <input
                type="radio"
                name="currency"
                value={c}
                checked={currency === c}
                onChange={() => setCurrency(c)}
              />
              {c}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
        >
          Save
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </main>
  );
}
