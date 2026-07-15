"use client";

import { FormEvent, useEffect, useState } from "react";

type Employment = {
  id: string;
  status: string;
  startedAt: string | null;
  pausedAt: string | null;
};

export function EmploymentPanel() {
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [status, setStatus] = useState("Inactive");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/employment/status");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load employment");
      return;
    }
    setStatus(json.status);
    setEmployment(json.employment);
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(path: string) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setMessage(json.message ?? `Status: ${json.employment?.status ?? json.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 max-w-xl space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">Employment</p>
        <p className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[#f4f7f0]">
          {status === "Active" ? "Employment Active" : status}
        </p>
        {employment?.startedAt ? (
          <p className="mt-2 text-sm text-[#b7c4b5]">
            Started {new Date(employment.startedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => run("/api/employment/start")}
          className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008] disabled:opacity-60"
        >
          Hire Sentry
        </button>
        <button
          type="button"
          disabled={loading || status !== "Active"}
          onClick={() => run("/api/employment/pause")}
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          disabled={loading || status !== "Paused"}
          onClick={() => run("/api/employment/resume")}
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm disabled:opacity-40"
        >
          Resume
        </button>
      </div>

      {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

export function WalletPanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connectAddress, setConnectAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("25");
  const [privateKeyOnce, setPrivateKeyOnce] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/wallet/balance");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load wallet");
      return;
    }
    setAddress(json.address);
    setBalance(json.balance ?? 0);
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createWallet() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/create", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setPrivateKeyOnce(json.privateKey);
      setMessage("Wallet created. Save the private key now — it is not stored.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: connectAddress }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Connect failed");
      setMessage("Wallet connected");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setLoading(false);
    }
  }

  async function deposit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const amount = Number(depositAmount);
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Deposit failed");
      setMessage(`Deposit recorded. New balance $${Number(json.balance).toFixed(2)}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">Wallet</p>
        <p className="mt-3 break-all font-mono text-sm text-[#e8f5d8]">
          {address ?? "No wallet yet"}
        </p>
        <p className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[#f4f7f0]">
          ${balance.toFixed(2)}
        </p>
      </div>

      {!address ? (
        <div className="space-y-4">
          <button
            type="button"
            disabled={loading}
            onClick={createWallet}
            className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
          >
            Create Wallet
          </button>
          <form onSubmit={connectWallet} className="space-y-3">
            <input
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm outline-none focus:border-[#35d07f]"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm"
            >
              Connect Wallet
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={deposit} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[#9aa89a]">
            Deposit amount (USD test value)
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="mt-2 block w-40 rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
          >
            Deposit
          </button>
        </form>
      )}

      {privateKeyOnce ? (
        <div className="rounded-xl border border-[#fcff52]/40 bg-[#fcff52]/10 p-4 text-sm">
          <p className="font-semibold text-[#fcff52]">Private key (save now)</p>
          <p className="mt-2 break-all font-mono text-[#e8f5d8]">{privateKeyOnce}</p>
        </div>
      ) : null}

      {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
