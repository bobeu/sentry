"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";

type ActionRow = {
  id: string;
  type: string;
  completedAt: string;
  group?: { name: string | null } | null;
};

type NextSettlement = {
  monetaryRemaining: number;
  actionsRemaining: number;
  timeRemainingMs: number;
};

type StatusPayload = {
  status: string;
  currency: string;
  wallet: {
    address: string;
    balance: number;
    availableBalance?: number;
    outstandingCharges?: number;
  } | null;
  groupsEnabled: number;
  actionsCompleted: number;
  todaySpend: number;
  lifetimeSpend: number;
  outstandingCharges?: number;
  availableBalance?: number;
  lastSettlementAt?: string | null;
  nextSettlement?: NextSettlement;
  recentActivity: ActionRow[];
};

function statusLabel(status: string) {
  if (status === "Active") return "🟢 Active";
  if (status === "Paused") return "Paused";
  if (status === "Exhausted") return "Exhausted";
  return "Inactive";
}

function actionLabel(type: string) {
  switch (type) {
    case "mention_reply":
      return "Answered mention";
    case "faq_answer":
      return "Answered FAQ";
    case "daily_summary":
      return "Generated summary";
    case "spam_moderation":
      return "Spam removed";
    case "mention_notification":
      return "Sent notification";
    case "welcome":
      return "Welcomed member";
    default:
      return type;
  }
}

function formatDuration(ms: number) {
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.ceil(mins / 60)}h`;
}

export function DashboardLive() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/employment/status");
      const json = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(json.error ?? "Unable to load dashboard");
        return;
      }
      setData(json);
    }
    void load();
    const id = setInterval(() => void load(), 15_000);
    const onWallet = () => void load();
    window.addEventListener("sentry:wallet-updated", onWallet);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("sentry:wallet-updated", onWallet);
    };
  }, []);

  if (loading) {
    return <p className="mt-10 text-[#9aa89a]">Loading dashboard…</p>;
  }

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-[#e8f5d8]">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-[#35d07f]">
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const balance = data.wallet?.balance ?? 0;
  const available = data.availableBalance ?? data.wallet?.availableBalance ?? balance;
  const outstanding = data.outstandingCharges ?? data.wallet?.outstandingCharges ?? 0;
  const currency = data.currency ?? "USDm";
  const next = data.nextSettlement;

  return (
    <div className="mt-10 space-y-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Employment Status" value={statusLabel(data.status)} description="Current employment" />
        <Card
          title="Current Balance"
          value={`${balance.toFixed(4)} ${currency}`}
          description="On-chain wallet balance"
        />
        <Card
          title="Available Balance"
          value={`${available.toFixed(4)} ${currency}`}
          description="Balance minus outstanding charges"
        />
        <Card
          title="Outstanding Charges"
          value={`${outstanding.toFixed(4)} ${currency}`}
          description="Work pending on-chain settlement"
        />
        <Card
          title="Today's Spend"
          value={`${(data.todaySpend ?? 0).toFixed(4)} ${currency}`}
          description="Completed work today"
        />
        <Card
          title="Lifetime Spend"
          value={`${(data.lifetimeSpend ?? 0).toFixed(4)} ${currency}`}
          description="Successfully settled on-chain"
        />
        <Card
          title="Last Settlement"
          value={
            data.lastSettlementAt
              ? new Date(data.lastSettlementAt).toLocaleString()
              : "None yet"
          }
          description="Most recent batch settlement"
        />
        <Card
          title="Next Settlement"
          value={
            next
              ? `${next.actionsRemaining} actions · ${next.monetaryRemaining.toFixed(2)} ${currency} · ${formatDuration(next.timeRemainingMs)}`
              : "—"
          }
          description="Thresholds until auto-settlement"
        />
        <Card
          title="Groups Enabled"
          value={data.groupsEnabled ?? 0}
          description="Active Telegram groups"
        />
        <Card
          title="Actions Completed"
          value={data.actionsCompleted ?? 0}
          description="Total completed work"
        />
      </div>

      <section>
        <h2 className="text-lg text-[#e8f5d8]">Recent Activity</h2>
        <ul className="mt-4 space-y-2">
          {(data.recentActivity ?? []).length === 0 ? (
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-[#9aa89a]">
              No actions yet. Hire Sentry, fund your wallet, and enable a group to get started.
            </li>
          ) : (
            data.recentActivity.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <span className="text-[#9aa89a]">
                  {new Date(a.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[#e8f5d8]">{actionLabel(a.type)}</span>
                <span className="text-[#9aa89a]">{a.group?.name ?? "—"}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
