"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type GroupRow = {
  id: string;
  telegramId: string;
  name: string | null;
  enabled: boolean;
  messagesToday: number;
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
    <div className="mt-8 space-y-8">
      <form onSubmit={enable} className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-[#9aa89a]">
          Telegram group chat ID
          <input
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="-100…"
            className="mt-2 block w-64 rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
        >
          Enable group
        </button>
      </form>

      <div className="grid gap-4">
        {groups.length === 0 ? (
          <p className="text-[#9aa89a]">
            No groups yet. Add the bot to a Telegram group, then enable it here.
          </p>
        ) : (
          groups.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div>
                <Link href={`/groups/${g.id}`} className="text-lg text-[#e8f5d8] hover:text-white">
                  {g.name ?? g.telegramId}
                </Link>
                <p className="mt-1 text-sm text-[#9aa89a]">
                  {g.enabled ? "Enabled" : "Disabled"} · Messages today {g.messagesToday} · FAQs{" "}
                  {g.faqCount}
                  {g.memberCount != null ? ` · Members ${g.memberCount}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/groups/${g.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm"
                >
                  Open
                </Link>
                {g.enabled ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => disable(g.id)}
                    className="rounded-full border border-white/20 px-4 py-2 text-sm"
                  >
                    Disable
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
