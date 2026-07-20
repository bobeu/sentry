"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

type SettingsState = {
  displayName: string;
  timeZone: string;
  autoResume: boolean;
  emailNotifications: boolean;
  telegramUserId: string;
  telegramUsername: string;
};

type ApiKeyRow = {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsState>({
    displayName: "",
    timeZone: "UTC",
    autoResume: true,
    emailNotifications: true,
    telegramUserId: "",
    telegramUsername: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState("default");

  async function loadKeys() {
    const res = await fetch("/api/agent/keys");
    const json = await res.json();
    if (res.ok) setKeys(json.keys ?? []);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!res.ok) {
        toast.push(json.error ?? "Failed to load settings");
        return;
      }
      setSettings(json.settings);
      await loadKeys();
    })();
  }, [toast]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSettings(json.settings);
      setMessage("Settings saved");
      toast.push("Settings saved", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    const res = await fetch("/api/agent/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: keyLabel }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.push(json.error ?? "Could not create key");
      return;
    }
    setNewKey(json.key);
    toast.push("API key created — copy it now", "success");
    await loadKeys();
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/agent/keys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json();
      toast.push(json.error ?? "Revoke failed");
      return;
    }
    toast.push("Key revoked", "info");
    await loadKeys();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href="/dashboard" className="text-sm text-[#9aa89a] hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Settings
      </h1>
      <p className="mt-3 max-w-xl text-[#9aa89a]">
        Preferences, Telegram identity, and agent-to-agent API keys.
      </p>

      <form onSubmit={onSubmit} className="mt-10 max-w-lg space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg text-[#e8f5d8]">General</h2>
          <label className="block text-sm text-[#9aa89a]">
            Display Name
            <input
              value={settings.displayName}
              onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
            />
          </label>
          <label className="block text-sm text-[#9aa89a]">
            Time Zone
            <input
              value={settings.timeZone}
              onChange={(e) => setSettings((s) => ({ ...s, timeZone: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
              placeholder="UTC"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg text-[#e8f5d8]">Employment</h2>
          <label className="flex items-center gap-3 text-sm text-[#c7d6c4]">
            <input
              type="checkbox"
              checked={settings.autoResume}
              onChange={(e) => setSettings((s) => ({ ...s, autoResume: e.target.checked }))}
            />
            Auto Resume
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg text-[#e8f5d8]">Notifications</h2>
          <label className="flex items-center gap-3 text-sm text-[#c7d6c4]">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) =>
                setSettings((s) => ({ ...s, emailNotifications: e.target.checked }))
              }
            />
            Email Notifications
          </label>
          <label className="block text-sm text-[#9aa89a]">
            Telegram username (for mention alerts)
            <input
              value={settings.telegramUsername}
              onChange={(e) => setSettings((s) => ({ ...s, telegramUsername: e.target.value }))}
              placeholder="bobman7000"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
            />
          </label>
          <label className="block text-sm text-[#9aa89a]">
            Telegram user ID (numeric, for private DMs)
            <input
              value={settings.telegramUserId}
              onChange={(e) => setSettings((s) => ({ ...s, telegramUserId: e.target.value }))}
              placeholder="123456789"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#35d07f] px-6 py-3 text-sm font-semibold text-[#061008] disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save settings"}
        </button>
        {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      </form>

      <section className="mt-14 max-w-lg space-y-4">
        <h2 className="text-lg text-[#e8f5d8]">Agent task API</h2>
        <p className="text-sm text-[#9aa89a]">
          Create a bearer key for <code className="text-[#8cf1b7]">POST /api/agent/v1/tasks</code>.
          Creating a key enables the API for your account.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm outline-none focus:border-[#35d07f]"
            placeholder="label"
          />
          <button
            type="button"
            onClick={createKey}
            className="rounded-full border border-white/20 px-4 py-2 text-sm"
          >
            Create key
          </button>
        </div>
        {newKey ? (
          <pre className="overflow-x-auto rounded-xl border border-[var(--accent)]/30 bg-black/40 p-3 text-xs text-[#8cf1b7]">
            {newKey}
          </pre>
        ) : null}
        <ul className="space-y-2 text-sm">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <span>
                {k.label} · {k.keyPrefix}…
              </span>
              <button
                type="button"
                className="text-xs text-red-300"
                onClick={() => revokeKey(k.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
