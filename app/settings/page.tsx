"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type SettingsState = {
  displayName: string;
  timeZone: string;
  autoResume: boolean;
  emailNotifications: boolean;
  telegramUserId: string;
  telegramUsername: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    displayName: "",
    timeZone: "UTC",
    autoResume: true,
    emailNotifications: true,
    telegramUserId: "",
    telegramUsername: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load settings");
        return;
      }
      setSettings(json.settings);
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
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
        General preferences plus Telegram identity for private mention notifications.
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
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </form>
    </main>
  );
}
