"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Overview = {
  generatedAt: string;
  users: {
    total: number;
    withActiveEmployment: number;
    withWallet: number;
    withTelegramLinked: number;
  };
  groups: { total: number; enabledLinks: number };
  actions: {
    last24h: number;
    last7d: number;
    last30d: number;
    byTypeLast7d: Array<{ type: string; count: number }>;
  };
  billing: {
    chargesLast7d: number;
    chargeAmountLast7d: number;
    settlementsLast30d: number;
  };
  rewards: { accounts: number; activeAccounts: number };
  agentApi: { keysActive: number; tasksLast7d: number };
};

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/analytics", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to load analytics");
        }
        setOverview(json.overview as Overview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/dashboard"
        className="text-sm font-bold text-muted hover:text-primary"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black text-text-dark sm:text-4xl">
        Owner analytics
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-muted">
        Platform-wide metrics for the Sentry grand admin (Telegram ID linked in
        Settings must match the owner account).
      </p>

      {loading ? (
        <p className="mt-8 text-sm font-bold text-muted">Loading…</p>
      ) : null}
      {error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      ) : null}

      {overview ? (
        <div className="mt-8 space-y-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Generated {new Date(overview.generatedAt).toLocaleString()}
          </p>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value={overview.users.total} />
            <Stat
              label="Active employment"
              value={overview.users.withActiveEmployment}
            />
            <Stat label="Wallets" value={overview.users.withWallet} />
            <Stat
              label="Telegram linked"
              value={overview.users.withTelegramLinked}
            />
            <Stat label="Groups" value={overview.groups.total} />
            <Stat label="Enabled links" value={overview.groups.enabledLinks} />
            <Stat label="Actions 24h" value={overview.actions.last24h} />
            <Stat label="Actions 7d" value={overview.actions.last7d} />
            <Stat label="Charges 7d" value={overview.billing.chargesLast7d} />
            <Stat
              label="Charge amount 7d"
              value={overview.billing.chargeAmountLast7d.toFixed(4)}
            />
            <Stat
              label="Settlements 30d"
              value={overview.billing.settlementsLast30d}
            />
            <Stat
              label="Reward accounts"
              value={`${overview.rewards.activeAccounts}/${overview.rewards.accounts}`}
            />
            <Stat label="API keys" value={overview.agentApi.keysActive} />
            <Stat
              label="Agent tasks 7d"
              value={overview.agentApi.tasksLast7d}
            />
          </section>

          <section className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark">
              Actions by type (7d)
            </h2>
            <ul className="mt-3 space-y-1.5">
              {overview.actions.byTypeLast7d.length === 0 ? (
                <li className="text-sm text-muted">No actions in the last 7 days.</li>
              ) : (
                overview.actions.byTypeLast7d.map((row) => (
                  <li
                    key={row.type}
                    className="flex justify-between text-sm font-medium text-text-dark"
                  >
                    <span className="font-mono text-xs">{row.type}</span>
                    <span>{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-text-dark">{value}</p>
    </div>
  );
}
