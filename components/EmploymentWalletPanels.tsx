"use client";

import { FormEvent, useEffect, useState } from "react";

type Employment = {
  id: string;
  status: string;
  startedAt: string | null;
  pausedAt: string | null;
};

type ChargeRow = {
  id: string;
  amount: number;
  label: string;
  createdAt: string;
  status: string;
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
      setMessage(json.message ?? `Status: ${json.employment?.status ?? "updated"}`);
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
  const [todaySpend, setTodaySpend] = useState(0);
  const [lifetimeSpend, setLifetimeSpend] = useState(0);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("25");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [balRes, spendRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/billing/spending"),
    ]);
    const balJson = await balRes.json();
    if (!balRes.ok) {
      setError(balJson.error ?? "Failed to load wallet");
      return;
    }
    setAddress(balJson.address);
    setBalance(balJson.balance ?? 0);
    setProvider(balJson.provider);
    setError(null);

    if (spendRes.ok) {
      const spendJson = await spendRes.json();
      setTodaySpend(spendJson.todaySpend ?? 0);
      setLifetimeSpend(spendJson.lifetimeSpend ?? 0);
      setCharges(spendJson.recentCharges ?? []);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function ensureWallet() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/create", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wallet failed");
      setMessage("Smart wallet ready (no private keys — managed by Sentry employment).");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet failed");
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
      setMessage(`Deposit recorded. New balance $${Number(json.balance).toFixed(3)} cUSD`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  }

  async function withdraw(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const amount = Number(withdrawAmount);
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Withdraw failed");
      setMessage(`Withdrawal recorded. New balance $${Number(json.balance).toFixed(3)} cUSD`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Balance</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            ${balance.toFixed(3)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Today&apos;s Spend</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            ${todaySpend.toFixed(3)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Lifetime Spend</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            ${lifetimeSpend.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">Smart Wallet</p>
        <p className="mt-3 break-all font-mono text-sm text-[#e8f5d8]">
          {address ?? "Not provisioned yet — hire Sentry or provision below"}
        </p>
        {provider ? (
          <p className="mt-2 text-xs text-[#9aa89a]">Provider: {provider}</p>
        ) : null}
      </div>

      {!address ? (
        <button
          type="button"
          disabled={loading}
          onClick={ensureWallet}
          className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
        >
          Provision Smart Wallet
        </button>
      ) : (
        <div className="flex flex-wrap gap-6">
          <form onSubmit={deposit} className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#9aa89a]">
              Deposit (cUSD)
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
          <form onSubmit={withdraw} className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#9aa89a]">
              Withdraw (cUSD)
              <input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="mt-2 block w-40 rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm"
            >
              Withdraw
            </button>
          </form>
        </div>
      )}

      <section>
        <h2 className="text-lg text-[#e8f5d8]">Recent Charges</h2>
        <ul className="mt-4 space-y-2">
          {charges.length === 0 ? (
            <li className="text-sm text-[#9aa89a]">No charges yet.</li>
          ) : (
            charges.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <span className="text-[#e8f5d8]">{c.label}</span>
                <span className="font-mono text-red-300">-{c.amount.toFixed(3)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
