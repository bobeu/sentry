"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

type SettingsState = {
  displayName: string;
  preferredNetwork: "CELO" | "GOAT";
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

type GoatStatus = {
  config: {
    network: string;
    chainId: number;
    registryIdentifier: string;
    configured: boolean;
  };
  identity: {
    agentId: string | null;
    agentUri: string | null;
    registeredAt: string | null;
    registrationTx: string | null;
  };
};

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsState>({
    displayName: "",
    preferredNetwork: "CELO",
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
  const [goat, setGoat] = useState<GoatStatus | null>(null);
  const [goatUri, setGoatUri] = useState("");
  const [goatBusy, setGoatBusy] = useState(false);

  async function loadKeys() {
    const res = await fetch("/api/agent/keys");
    const json = await res.json();
    if (res.ok) setKeys(json.keys ?? []);
  }

  async function loadGoat() {
    const res = await fetch("/api/goat/erc8004");
    const json = await res.json();
    if (!res.ok) return;
    setGoat(json);
    setGoatUri(json.identity?.agentUri ?? "");
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
      await loadGoat();
    })();
  }, [toast]);

  async function runGoatAction(action: "register_agent" | "set_agent_uri") {
    setGoatBusy(true);
    try {
      const payload =
        action === "register_agent"
          ? { action, agentUri: goatUri || undefined }
          : { action, agentUri: goatUri };
      const res = await fetch("/api/goat/erc8004", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "GOAT action failed");
      toast.push(json.message ?? "GOAT identity updated", "success");
      await loadGoat();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "GOAT action failed");
    } finally {
      setGoatBusy(false);
    }
  }

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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-8 animate-rise">
      <div className="border-b border-primary/15 pb-5">
        <Link href="/dashboard" className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-black text-text-dark">
          Settings
        </h1>
        <p className="mt-1.5 text-xs text-muted font-semibold">
          Preferences, Telegram identity, and agent-to-agent API credentials.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-6">
        {/* General Settings */}
        <div className="surface-card p-6 space-y-4 border border-primary/10 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/10 pb-2">
            General Configuration
          </h2>
          <label className="block text-xs text-muted font-semibold">
            Display Name
            <input
              value={settings.displayName}
              onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition text-sm"
            />
          </label>
          <label className="block text-xs text-muted font-semibold">
            Time Zone
            <input
              value={settings.timeZone}
              onChange={(e) => setSettings((s) => ({ ...s, timeZone: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition font-mono text-sm"
              placeholder="UTC"
            />
          </label>
          <label className="block text-xs text-muted font-semibold">
            Preferred Network
            <select
              value={settings.preferredNetwork}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  preferredNetwork: e.target.value as "CELO" | "GOAT",
                }))
              }
              className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition text-sm font-bold"
            >
              <option value="CELO">CELO (existing billing network)</option>
              <option value="GOAT">GOAT (AgentKit + ERC-8004)</option>
            </select>
          </label>
        </div>

        {/* Identity & Notifications */}
        <div className="surface-card p-6 space-y-4 border border-primary/10 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/10 pb-2">
            Identity & Alerts
          </h2>
          <label className="flex items-center gap-3 text-sm text-text-dark font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoResume}
              onChange={(e) => setSettings((s) => ({ ...s, autoResume: e.target.checked }))}
              className="rounded border-primary/20 text-primary focus:ring-0 focus:ring-offset-0 h-4 w-4 accent-primary cursor-pointer"
            />
            Auto Resume Employment
          </label>
          <label className="flex items-center gap-3 text-sm text-text-dark font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) =>
                setSettings((s) => ({ ...s, emailNotifications: e.target.checked }))
              }
              className="rounded border-primary/20 text-primary focus:ring-0 focus:ring-offset-0 h-4 w-4 accent-primary cursor-pointer"
            />
            Email Notifications
          </label>

          <div className="border-t border-primary/10 my-4 pt-4 space-y-4">
            <label className="block text-xs text-muted font-semibold">
              Telegram Username (for mention alerts)
              <input
                value={settings.telegramUsername}
                onChange={(e) => setSettings((s) => ({ ...s, telegramUsername: e.target.value }))}
                placeholder="bobman7000"
                className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition text-sm"
              />
            </label>
            <label className="block text-xs text-muted font-semibold">
              Telegram User ID (numeric, for private DMs)
              <input
                value={settings.telegramUserId}
                onChange={(e) => setSettings((s) => ({ ...s, telegramUserId: e.target.value }))}
                placeholder="123456789"
                className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition font-mono text-sm"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/95 cursor-pointer disabled:opacity-60 transition"
          >
            {loading ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-slate-900 font-bold">
            {message}
          </div>
        )}
      </form>

      {/* Task API credentials */}
      <div className="surface-card p-6 space-y-4 max-w-xl border border-primary/10 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/10 pb-2">
          Agent Task API Credentials
        </h2>
        <p className="text-xs text-muted leading-relaxed font-medium">
          Allows external backends to delegate tasks via <code className="text-primary font-bold font-mono bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">POST /api/agent/v1/tasks</code>. Each request accrues a small on-chain fee.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <input
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            className="rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-medium transition flex-1 min-w-[180px]"
            placeholder="Label (e.g. dev-backend)"
          />
          <button
            type="button"
            onClick={createKey}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/95 cursor-pointer transition shadow-sm"
          >
            Generate Key
          </button>
        </div>

        {newKey && (
          <div className="p-3.5 bg-bg-light/60 border border-primary/15 rounded-lg">
            <p className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wider">Generated API Secret Token (Copy immediately):</p>
            <pre className="overflow-x-auto text-xs text-primary font-mono py-1 leading-relaxed">
              {newKey}
            </pre>
          </div>
        )}

        <ul className="space-y-2.5 pt-2 border-t border-primary/10">
          {keys.length === 0 ? (
            <li className="text-xs text-muted py-2 font-medium">No API keys registered.</li>
          ) : (
            keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-primary/10 bg-white px-3.5 py-2.5 text-xs text-text-dark shadow-sm"
              >
                <span className="font-mono font-bold">
                  🔑 {k.label} &middot; <span className="text-muted font-medium">{k.keyPrefix}&hellip;</span>
                </span>
                <button
                  type="button"
                  className="text-[10px] font-bold text-alert hover:underline uppercase cursor-pointer"
                  onClick={() => revokeKey(k.id)}
                >
                  Revoke
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="surface-card p-6 space-y-4 max-w-xl border border-primary/10 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/10 pb-2">
          GOAT Agent Identity (ERC-8004)
        </h2>
        <p className="text-xs text-muted leading-relaxed font-medium">
          This uses GOAT AgentKit to register your Sentry identity on GOAT without changing existing CELO settlement flows.
        </p>
        <div className="text-[11px] text-muted font-medium space-y-1">
          <p>Network: <span className="font-bold text-text-dark">{goat?.config.network ?? "goat-testnet"}</span></p>
          <p>Registry: <span className="font-mono text-text-dark">{goat?.config.registryIdentifier ?? "—"}</span></p>
          <p>Wallet key configured: <span className="font-bold text-text-dark">{goat?.config.configured ? "Yes" : "No (set GOAT_AGENT_PRIVATE_KEY)"}</span></p>
          <p>Agent ID: <span className="font-mono text-text-dark">{goat?.identity.agentId ?? "Not registered"}</span></p>
        </div>

        <label className="block text-xs text-muted font-semibold">
          Agent Metadata URI (HTTPS/IPFS)
          <input
            value={goatUri}
            onChange={(e) => setGoatUri(e.target.value)}
            placeholder="https://example.com/registration.json"
            className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary transition text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={goatBusy}
            onClick={() => void runGoatAction("register_agent")}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/95 cursor-pointer transition shadow-sm disabled:opacity-60"
          >
            Register GOAT Agent
          </button>
          <button
            type="button"
            disabled={goatBusy || !goat?.identity.agentId}
            onClick={() => void runGoatAction("set_agent_uri")}
            className="rounded-full border border-primary/15 bg-white px-5 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-50 cursor-pointer transition shadow-sm disabled:opacity-60"
          >
            Update Agent URI
          </button>
        </div>
      </div>
    </main>
  );
}

