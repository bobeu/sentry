"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { useToast } from "@/components/Toast";

type ProofPayload = {
  proof: { content: string; actions: number; groups: number };
  escalations: Array<{
    id: string;
    reason: string | null;
    draftText: string;
    group: { name: string | null; telegramId: string };
  }>;
  incidents: Array<{
    id: string;
    trigger: string;
    status: string;
    group: { name: string | null; telegramId: string };
  }>;
  handovers: Array<{
    id: string;
    content: string | null;
    createdAt: string;
    group: { name: string | null; telegramId: string } | null;
  }>;
};

export function AgentCapacityPanel() {
  const toast = useToast();
  const [data, setData] = useState<ProofPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/proof");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (res.status !== 401) toast.push(json.error ?? "Could not load agent capacity");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) toast.push("Agent capacity temporarily unavailable");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  if (!data) return null;

  return (
    <section className="space-y-6 animate-rise-delay-1">
      <div className="flex items-end justify-between border-b border-primary/15 pb-4">
        <div>
          <h2 className="text-2xl font-black text-text-dark">
            Agent Capacity & Throughput
          </h2>
          <p className="mt-1 text-sm text-muted font-medium">
            Shift handovers, escalations, incident controls, and proof-of-work telemetry.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Proof of work (7d)"
          value={data.proof.actions}
          description={`${data.proof.groups} enabled groups`}
        />
        <Card
          title="Pending escalations"
          value={data.escalations.length}
          description="Awaiting approval in Telegram DM"
        />
        <Card
          title="Open incidents"
          value={data.incidents.length}
          description="Crisis triggers active"
        />
        <Card
          title="Recent handovers"
          value={data.handovers.length}
          description="Shift briefs sent this week"
        />
      </div>

      {data.escalations.length > 0 ? (
        <div className="surface-card p-6 border-l-4 border-l-warning">
          <div className="flex items-center gap-2 mb-4 border-b border-primary/5 pb-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning"></span>
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-warning">
              Pending Approvals (Action Required)
            </p>
          </div>
          <ul className="space-y-3.5">
            {data.escalations.slice(0, 5).map((e) => (
              <li key={e.id} className="rounded-xl border border-primary/10 bg-bg-light/40 p-4">
                <div className="flex items-center justify-between gap-4 border-b border-primary/5 pb-2 mb-2">
                  <span className="font-bold text-text-dark text-sm">
                    💬 {e.group.name ?? "Telegram Chat"}
                  </span>
                  <span className="text-[10px] bg-warning/15 text-warning px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-warning/10">
                    {e.reason ?? "escalation"}
                  </span>
                </div>
                <p className="text-[10px] text-muted mb-2 font-bold uppercase tracking-wider">Proposed Response Draft:</p>
                <div className="telegram-bubble-out text-white p-3.5 text-xs font-medium italic">
                  &ldquo;{e.draftText}&rdquo;
                </div>
                <p className="mt-3.5 text-[10px] text-muted font-semibold">
                  Use Sentry Telegram DM to tap <strong className="text-text-dark font-extrabold">Approve</strong> or type <strong className="text-text-dark font-extrabold">edit: [your text]</strong>.
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.proof.content ? (
        <div className="space-y-2">
          <p className="text-xs uppercase font-extrabold tracking-widest text-muted">
            Raw Weekly Proof of Work
          </p>
          <pre className="surface-card overflow-x-auto whitespace-pre-wrap p-5 text-xs text-primary font-mono bg-white max-h-60 border border-primary/10 rounded-xl leading-relaxed">
            {data.proof.content}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
