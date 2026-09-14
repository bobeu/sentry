"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";
import Image from "next/image";
import { AgentCapacityPanel } from "@/components/AgentCapacityPanel";
import { useToast } from "@/components/Toast";

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
  if (status === "Active") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-[#00D283] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D283]"></span>
        </span>
        <span className="text-[#00D283] font-bold uppercase tracking-wider text-xs">ON DUTY</span>
      </span>
    );
  }
  if (status === "Paused") {
    return <span className="text-warning font-bold uppercase tracking-wider text-xs">⏸ PAUSED</span>;
  }
  if (status === "Exhausted") {
    return <span className="text-alert font-bold uppercase tracking-wider text-xs">⚠️ EXHAUSTED</span>;
  }
  return <span className="text-muted font-bold uppercase tracking-wider text-xs">INACTIVE</span>;
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
    case "shift_handover":
      return "Shift handover";
    case "escalation":
      return "Escalation";
    case "intent_signal":
      return "Intent signal";
    case "incident_mode":
      return "Incident mode";
    case "proof_report":
      return "Proof of work";
    case "playbook_learn":
      return "Playbook learn";
    case "member_memory":
      return "Member memory";
    case "agent_task":
      return "Agent API task";
    default:
      return type;
  }
}

function formatDuration(ms: number) {
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.ceil(mins / 60)}h`;
}

const getActionColorClass = (type: string) => {
  switch (type) {
    case "spam_moderation":
      return "border-l-[3px] border-l-alert";
    case "mention_reply":
    case "faq_answer":
      return "border-l-[3px] border-l-primary";
    case "shift_handover":
    case "escalation":
      return "border-l-[3px] border-l-warning";
    case "incident_mode":
      return "border-l-[3px] border-l-alert animate-pulse";
    default:
      return "border-l-[3px] border-l-accent";
  }
};

export function DashboardLive() {
  const toast = useToast();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/employment/status");
        const json = await res.json();
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          const msg = json.error ?? "Unable to load dashboard";
          setError(msg);
          if (res.status !== 401) toast.push(msg);
          return;
        }
        setError(null);
        setData(json);
      } catch {
        if (cancelled) return;
        setLoading(false);
        const msg = "Dashboard data is temporarily unavailable. Please try again shortly.";
        setError(msg);
        toast.push(msg);
      }
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
  }, [toast]);

  if (loading) {
    return (
      <div className="mt-10 flex flex-col items-center justify-center py-20 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted font-medium">Synchronizing agent terminal data…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-10 surface-card p-8 text-center max-w-md mx-auto space-y-4 border border-primary/10">
        <p className="text-text-dark font-semibold">{error}</p>
        <Link 
          href="/login" 
          className="inline-block rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/95 transition cursor-pointer"
        >
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
    <div className="mt-8 space-y-8 animate-rise">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-primary p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div className="space-y-2 max-w-xl text-left">
          <h1 className="text-2xl font-black tracking-tight leading-tight">Active Sentry Command Terminal</h1>
          <p className="text-xs text-white/80 leading-relaxed font-medium">
            Review real-time transaction settlements, automated moderate actions, and playbook instruction triggers. Sentry is synchronised with the Celo network.
          </p>
        </div>
        <div className="relative h-24 w-36 rounded-xl overflow-hidden border border-white/20 shrink-0">
          <Image src="/dashboard.png" alt="Dashboard Graphic" fill className="object-cover object-top" />
        </div>
      </div>

      <section className="space-y-3.5">
        <h2 className="text-xs uppercase font-extrabold tracking-widest text-muted">
          Prepaid Billing & Wallet Console
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Prepaid Balance"
            value={`${balance.toFixed(4)} ${currency}`}
            description="Total Celo on-chain wallet balance"
          />
          <Card
            title="Available Balance"
            value={`${available.toFixed(4)} ${currency}`}
            description="Balance minus outstanding charges"
          />
          <Card
            title="Outstanding Charges"
            value={`${outstanding.toFixed(4)} ${currency}`}
            description="Work completed, awaiting settlement"
          />
          <Card
            title="Spend Profile"
            value={`${(data.todaySpend ?? 0).toFixed(4)} ${currency}`}
            description={`Lifetime settled: ${(data.lifetimeSpend ?? 0).toFixed(2)} ${currency}`}
          />
        </div>
      </section>

      <section className="space-y-3.5">
        <h2 className="text-xs uppercase font-extrabold tracking-widest text-muted">
          Operational Terminal
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Duty Status"
            value={statusLabel(data.status)}
            description="Current employee credentials"
          />
          <Card
            title="Monitored Channels"
            value={data.groupsEnabled ?? 0}
            description="Active Telegram groups"
          />
          <Card
            title="Actions Throughput"
            value={data.actionsCompleted ?? 0}
            description="Total resolved tasks"
          />
          <Card
            title="Auto-Settlement Thresholds"
            value={next ? `${next.actionsRemaining} actions` : "—"}
            description={
              next
                ? `Limit: ${next.monetaryRemaining.toFixed(1)} ${currency} · Delay: ${formatDuration(next.timeRemainingMs)}`
                : "Awaiting next charges"
            }
          />
        </div>
      </section>

      <AgentCapacityPanel />

      {/* Visual feature banners */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm group">
          <div className="relative h-40 w-full overflow-hidden">
            <Image src="/escalation_dashboard.png" alt="Escalation Dashboard" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90" />
          </div>
          <div className="px-5 pb-5 pt-2">
            <h3 className="text-sm font-black text-text-dark">Escalation Dashboard</h3>
            <p className="mt-1 text-xs text-muted font-medium leading-relaxed">High-stakes messages are escalated to you with approve/ignore controls before posting.</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm group">
          <div className="relative h-40 w-full overflow-hidden">
            <Image src="/handover.png" alt="Shift Handover" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90" />
          </div>
          <div className="px-5 pb-5 pt-2">
            <h3 className="text-sm font-black text-text-dark">Shift Handover</h3>
            <p className="mt-1 text-xs text-muted font-medium leading-relaxed">Daily shift briefs: what was handled, open questions, and what needs your attention.</p>
          </div>
        </div>
      </div>

      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase font-extrabold tracking-widest text-muted">
            Live Action Logs
          </h2>
          <div className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-bold uppercase tracking-wider">
            Real-Time webhook feed
          </div>
        </div>

        <ul className="space-y-2.5">
          {(data.recentActivity ?? []).length === 0 ? (
            <li className="rounded-xl border border-primary/10 bg-white px-6 py-8 text-center text-sm text-muted font-medium">
              No actions recorded yet. Hire Sentry, fund your wallet, and enable a group chat.
            </li>
          ) : (
            data.recentActivity.map((a) => (
              <li
                key={a.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/10 bg-white px-5 py-3 text-sm shadow-sm transition hover:bg-slate-50 ${getActionColorClass(
                  a.type
                )}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted font-bold font-mono bg-bg-light px-2 py-0.5 rounded border border-primary/5">
                    {new Date(a.completedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-bold text-text-dark">{actionLabel(a.type)}</span>
                </div>
                <span className="text-[10px] text-muted font-bold bg-bg-light px-2.5 py-1 rounded-full border border-primary/5">
                  💬 {a.group?.name ?? "Telegram Chat"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
