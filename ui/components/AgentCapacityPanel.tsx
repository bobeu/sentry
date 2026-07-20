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
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#f1faea]">
          Agent capacity
        </h2>
        <p className="mt-1 text-sm text-[#9aa89a]">
          Shift handovers, escalations, incidents, and proof-of-work.
        </p>
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
          description="Approve in Telegram DM"
        />
        <Card
          title="Open incidents"
          value={data.incidents.length}
          description="Crisis mode triggers"
        />
        <Card
          title="Recent handovers"
          value={data.handovers.length}
          description="Shift briefs this week"
        />
      </div>

      {data.escalations.length > 0 ? (
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Needs approval</p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.escalations.slice(0, 5).map((e) => (
              <li key={e.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[#e8f5d8]">
                  {e.group.name ?? e.group.telegramId} — {e.reason ?? "review"}
                </p>
                <p className="mt-1 line-clamp-2 text-[#9aa89a]">{e.draftText}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.proof.content ? (
        <pre className="surface-card overflow-x-auto whitespace-pre-wrap p-5 text-xs text-[#b7c4b5]">
          {data.proof.content}
        </pre>
      ) : null}
    </section>
  );
}
