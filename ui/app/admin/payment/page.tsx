"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CurrencyConfig = {
  currency: string;
  enabled: boolean;
  tokenAddress: string | null;
};

export default function AdminPaymentPage() {
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/payment/currency");
    const json = await res.json();
    if (res.ok) setCurrencies(json.currencies ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function update(currency: string, patch: Partial<CurrencyConfig>) {
    setCurrencies((rows) =>
      rows.map((row) => (row.currency === currency ? { ...row, ...patch } : row)),
    );
  }

  async function save(config: CurrencyConfig) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/payment/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage(`${config.currency} configuration updated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/dashboard" className="text-sm text-[#9aa89a] hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Admin · Payment Currencies
      </h1>
      <p className="mt-3 text-sm text-[#9aa89a]">
        Enable currencies for future wallets and update ERC20 addresses. Existing wallets
        retain their immutable currency configuration.
      </p>

      <div className="mt-8 space-y-3">
        {currencies.map((config) => (
          <section
            key={config.currency}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg text-[#e8f5d8]">{config.currency}</h2>
              <label className="flex items-center gap-2 text-sm text-[#b7c4b5]">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(event) =>
                    update(config.currency, { enabled: event.target.checked })
                  }
                />
                Enabled
              </label>
            </div>
            {config.currency !== "CELO" ? (
              <input
                value={config.tokenAddress ?? ""}
                onChange={(event) =>
                  update(config.currency, { tokenAddress: event.target.value })
                }
                placeholder="ERC20 contract address"
                className="mt-4 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm outline-none focus:border-[#35d07f]"
              />
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => save(config)}
              className="mt-4 rounded-full bg-[#35d07f] px-4 py-2 text-sm font-semibold text-[#061008] disabled:opacity-50"
            >
              Save {config.currency}
            </button>
          </section>
        ))}
      </div>

      {message ? <p className="mt-4 text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </main>
  );
}
