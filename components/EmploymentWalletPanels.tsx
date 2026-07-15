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

type ChargeRow = {
  id: string;
  amount: number;
  currency: string;
  label: string;
  createdAt: string;
  status: string;
};

export function WalletPanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("USDm");
  const [todaySpend, setTodaySpend] = useState(0);
  const [lifetimeSpend, setLifetimeSpend] = useState(0);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [balRes, spendRes, currencyRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/billing/spending"),
      fetch("/api/payment/currency"),
    ]);
    const balJson = await balRes.json();
    if (!balRes.ok) {
      setError(balJson.error ?? "Failed to load wallet");
      return;
    }
    setAddress(balJson.address);
    setBalance(balJson.balance ?? 0);
    setError(null);

    if (spendRes.ok) {
      const spendJson = await spendRes.json();
      setTodaySpend(spendJson.todaySpend ?? 0);
      setLifetimeSpend(spendJson.lifetimeSpend ?? 0);
      setCharges(spendJson.recentCharges ?? []);
      setCurrency(spendJson.currency ?? "USDm");
    }
    if (currencyRes.ok) {
      const c = await currencyRes.json();
      setCurrency(c.currency ?? "USDm");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function syncDeposit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/deposit", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setMessage(`Balance synced: ${Number(json.balance).toFixed(3)} ${json.currency}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
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
      setMessage(`Withdrawal recorded. Balance ${Number(json.balance).toFixed(3)} ${json.currency}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <div className="inline-flex rounded-full border border-[#35d07f]/30 bg-[#35d07f]/10 px-4 py-1.5 text-sm text-[#35d07f]">
        Current Currency · {currency}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Balance</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            {balance.toFixed(3)} {currency}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Today&apos;s Spend</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            {todaySpend.toFixed(3)} {currency}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9aa89a]">Lifetime Spend</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#f4f7f0]">
            {lifetimeSpend.toFixed(3)} {currency}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">Employment Wallet</p>
        <p className="mt-3 break-all font-mono text-sm text-[#e8f5d8]">
          {address ?? "Hire Sentry to provision your wallet"}
        </p>
        {address ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyAddress}
              className="rounded-full border border-white/20 px-4 py-2 text-sm"
            >
              {copied ? "Copied" : "Copy Address"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={syncDeposit}
              className="rounded-full bg-[#35d07f] px-4 py-2 text-sm font-semibold text-[#061008]"
            >
              Sync Balance
            </button>
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[#9aa89a]">
        <h2 className="text-lg text-[#e8f5d8]">Funding Options</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-[#e8f5d8]">Send funds directly</strong> — transfer {currency} to
            your wallet address above. Click Sync Balance after confirmation.
          </li>
          <li>
            <strong className="text-[#e8f5d8]">Connect wallet (web)</strong> — call{" "}
            <code className="text-[#35d07f]">depositNative</code> or{" "}
            <code className="text-[#35d07f]">depositERC20</code> on the Employment contract from
            your connected wallet.
          </li>
        </ol>
      </section>

      {address ? (
        <form onSubmit={withdraw} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[#9aa89a]">
            Withdraw ({currency})
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
      ) : null}

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
                <span className="text-[#e8f5d8]">
                  {c.label}{" "}
                  <span className="text-[#9aa89a]">({c.status})</span>
                </span>
                <span className="font-mono text-red-300">
                  -{c.amount.toFixed(3)} {c.currency}
                </span>
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
