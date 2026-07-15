"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";

type ActionRow = {
  id: string;
  type: string;
  billable: boolean;
  completedAt: string;
  group?: { name: string | null } | null;
};

type StatusPayload = {
  status: string;
  wallet: { address: string; balance: number } | null;
  groups: number;
  actionsCompleted: number;
  billableToday: number;
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
      return "Answered Mention";
    case "faq_answer":
      return "Answered FAQ";
    case "daily_summary":
      return "Generated Summary";
    case "spam_moderation":
      return "Moderated Spam";
    case "mention_notification":
      return "Sent Notification";
    case "welcome":
      return "Welcomed Member";
    default:
      return type;
  }
}

export function DashboardLive() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/employment/status");
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "Unable to load dashboard");
        return;
      }
      setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!data) {
    return <p className="mt-10 text-[#9aa89a]">Loading live employment data…</p>;
  }

  const balance = data.wallet?.balance ?? 0;

  return (
    <div className="mt-10 space-y-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Wallet Balance"
          value={`$${balance.toFixed(2)}`}
          description={data.wallet?.address ?? "No smart wallet yet"}
        />
        <Card
          title="Employment Status"
          value={statusLabel(data.status)}
          description="Hire, pause, or resume from Employment"
        />
        <Card
          title="Connected Groups"
          value={data.groups}
          description="Groups with Sentry enabled"
        />
        <Card
          title="Actions Completed"
          value={data.actionsCompleted}
          description="All completed work logged"
        />
        <Card
          title="Today's Billable Actions"
          value={data.billableToday}
          description="Work queued for future billing"
        />
      </div>

      <section>
        <h2 className="text-lg text-[#e8f5d8]">Recent Activity</h2>
        <ul className="mt-4 space-y-2">
          {(data.recentActivity ?? []).length === 0 ? (
            <li className="text-sm text-[#9aa89a]">No actions yet.</li>
          ) : (
            data.recentActivity.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <span className="text-[#e8f5d8]">{actionLabel(a.type)}</span>
                <span className="text-[#9aa89a]">
                  {a.group?.name ?? "—"} · {new Date(a.completedAt).toLocaleString()}
                  {a.billable ? " · billable" : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
