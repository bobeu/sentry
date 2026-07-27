"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";


type GroupRow = {
  id: string;
  telegramId: string;
  name: string | null;
  enabled: boolean;
  actionsToday: number;
  mentionsHandled: number;
  spamRemoved: number;
  summaryStatus: string;
  faqCount: number;
  memberCount: number | null;
};

export function GroupsPanel() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [telegramId, setTelegramId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/groups");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load groups");
      return;
    }
    setGroups(json.groups);
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function enable(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/groups/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Enable failed");
      setMessage(`Enabled group ${json.telegramId}`);
      setTelegramId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enable failed");
    } finally {
      setLoading(false);
    }
  }

  async function disable(groupId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Disable failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disable failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-8 animate-rise">
      {/* Many Roles Illustration Header */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-primary p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div className="space-y-2 max-w-xl text-left">
          <h1 className="text-2xl font-black tracking-tight leading-tight">Active Sentry Employments</h1>
          <p className="text-xs text-white/80 leading-relaxed font-medium">
            Deploy Sentry to moderate spam, answer questions, welcome members, and generate daily briefings in multiple group channels simultaneously.
          </p>
        </div>
        <div className="relative h-24 w-36 rounded-xl overflow-hidden border border-white/20 shrink-0">
          <Image src="/many_roles.png" alt="Sentry Roles Graphic" fill className="object-cover object-center" />
        </div>
      </div>

      {/* Enable Group Console */}
      <div className="surface-card p-6 space-y-4 max-w-xl border border-primary/10 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-dark">
          🚀 Connect Telegram Channel
        </h2>
        <form onSubmit={enable} className="flex flex-wrap items-end gap-3.5">
          <label className="flex-1 text-xs text-muted">
            Telegram group chat ID (starts with -100)
            <input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="-1001285489868"
              className="mt-2 block w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-text-dark outline-none focus:border-primary font-mono text-xs"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-accent px-6 py-3 text-xs font-bold text-slate-900 shadow hover:bg-accent/95 cursor-pointer disabled:opacity-50"
          >
            Enable Group
          </button>
        </form>
        <p className="text-xs text-muted leading-relaxed font-medium">
          Add <strong className="text-text-dark font-extrabold">@tgemployee_bot</strong> to your group as an <strong className="text-text-dark font-extrabold">Admin</strong>, then paste the numeric chat ID above to initialize Sentry.
        </p>
      </div>

      {/* Groups Grid */}
      <div className="space-y-4">
        <h2 className="text-xs uppercase font-extrabold tracking-widest text-muted">
          Active Employments
        </h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted py-4 font-medium">
            No groups enabled yet. Add the bot to your Telegram chat to start.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="surface-card p-6 flex flex-col justify-between gap-4 transition hover:-translate-y-0.5 border border-primary/10 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/groups/${g.id}`}
                      className="text-lg font-extrabold text-text-dark hover:text-primary transition"
                    >
                      💬 {g.name ?? g.telegramId}
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        g.enabled
                          ? "bg-[#00D283]/10 text-[#00D283] border border-[#00D283]/20"
                          : "bg-slate-100 text-muted border border-primary/5"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${g.enabled ? "bg-[#00D283]" : "bg-muted"}`} />
                      {g.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted pt-1 font-semibold">
                    <p>Actions Today: <strong className="text-text-dark font-bold">{g.actionsToday ?? 0}</strong></p>
                    <p>FAQs Ingested: <strong className="text-text-dark font-bold">{g.faqCount}</strong></p>
                    <p>Mentions: <strong className="text-text-dark font-bold">{g.mentionsHandled ?? 0}</strong></p>
                    <p>Spam Removed: <strong className="text-text-dark font-bold">{g.spamRemoved ?? 0}</strong></p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-primary/5 pt-3.5">
                  <Link
                    href={`/groups/${g.id}`}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/95 transition"
                  >
                    Open Console
                  </Link>
                  {g.enabled && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => disable(g.id)}
                      className="rounded-full border border-primary/10 px-4 py-2 text-xs font-bold text-alert hover:bg-alert/5 transition cursor-pointer"
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-slate-900 font-bold max-w-xl">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-alert/25 bg-alert/10 px-4 py-3 text-sm text-alert font-bold max-w-xl">
          {error}
        </div>
      )}
    </div>
  );
}
