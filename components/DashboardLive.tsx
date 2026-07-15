"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";

type StatusPayload = {
  status: string;
  wallet: { address: string; balance: number } | null;
  groups: number;
  tasks: number;
};

function statusLabel(status: string) {
  if (status === "Active") return "🟢 Active";
  if (status === "Paused") return "Paused";
  if (status === "Exhausted") return "Exhausted";
  return "Inactive";
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
    <div className="mt-10 grid gap-5 sm:grid-cols-2">
      <Card
        title="Employment"
        value={statusLabel(data.status)}
        description="Hire, pause, or resume from the Employment page"
      />
      <Card
        title="Wallet"
        value={`$${balance.toFixed(2)}`}
        description={data.wallet?.address ?? "No wallet connected"}
      />
      <Card title="Groups" value={data.groups} description="Telegram groups come in a later prompt" />
      <Card title="Tasks" value={data.tasks} description="Task tracking comes with AI work" />
    </div>
  );
}
