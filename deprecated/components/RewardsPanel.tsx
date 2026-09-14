"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { celo } from "viem/chains";
import { useToast } from "@/components/Toast";
import { getInjectedProvider } from "@/lib/wagmi";
import { tokenDecimals, type PaymentCurrency } from "@/lib/payment-currency";
import { CELO_ATTRIBUTION_SUFFIX } from "@/lib/attribution";

type RewardRow = {
  groupId: string;
  groupName: string | null;
  telegramId: string;
  account: {
    id: string;
    address: string;
    currency: string;
    status: string;
  } | null;
  operator?: string | null;
  rewardEnabled: boolean;
  rewardPaused: boolean;
  rewardAmountPerPoint: string;
  rewardCurrency: string;
  balance?: string | null;
  balances?: Record<string, string> | null;
  factoryConfigured: boolean;
};

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

function envToken(currency: string): Address | null {
  const map: Record<string, string | undefined> = {
    USDm: process.env.NEXT_PUBLIC_CELO_USDM_ADDRESS || process.env.CELO_USDM_ADDRESS,
    USDC: process.env.NEXT_PUBLIC_CELO_USDC_ADDRESS || process.env.CELO_USDC_ADDRESS,
    USDT: process.env.NEXT_PUBLIC_CELO_USDT_ADDRESS || process.env.CELO_USDT_ADDRESS,
  };
  const defaults: Record<string, string> = {
    USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  };
  const raw = (map[currency] || defaults[currency] || "").trim();
  return raw.startsWith("0x") ? (raw as Address) : null;
}

export function RewardsPanel({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const { isConnected, address: connectedAddress } = useAccount();
  const [rows, setRows] = useState<RewardRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"fund" | "controls">("fund");
  const [fundAmount, setFundAmount] = useState("1");
  const [fundCurrency, setFundCurrency] = useState<PaymentCurrency>("USDm");
  const [operatorInput, setOperatorInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/rewards/overview", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load rewards");
    const groups = (json.groups ?? []) as RewardRow[];
    setRows(groups);
    setSelectedGroupId((prev) => {
      if (prev && groups.some((g) => g.groupId === prev)) return prev;
      return groups[0]?.groupId ?? "";
    });
    return groups;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load rewards");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const row = useMemo(
    () => rows.find((r) => r.groupId === selectedGroupId) ?? null,
    [rows, selectedGroupId],
  );

  const address = row?.account?.address ?? null;
  const currency = fundCurrency;
  const balances = row?.balances ?? null;
  const balance =
    balances?.[fundCurrency] != null
      ? Number(balances[fundCurrency])
      : row?.balance != null
        ? Number(row.balance)
        : 0;
  const hasAccount = Boolean(address);

  useEffect(() => {
    if (
      row?.rewardCurrency &&
      ["CELO", "USDm", "USDC", "USDT"].includes(row.rewardCurrency)
    ) {
      setFundCurrency(row.rewardCurrency as PaymentCurrency);
    }
  }, [row?.rewardCurrency, row?.groupId]);

  async function refresh(notify = false) {
    setBusy(true);
    setError(null);
    try {
      const groups = await load();
      const selected =
        groups.find((g) => g.groupId === selectedGroupId) ?? groups[0] ?? null;
      if (notify && selected?.account) {
        const parts = selected.balances
          ? Object.entries(selected.balances)
              .map(([c, v]) => `${Number(v).toFixed(4)} ${c}`)
              .join(" · ")
          : `${selected.balance ?? "—"}`;
        setMessage(`Balances updated: ${parts}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function createAccount() {
    if (!row) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/groups/${row.groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ensure",
          currency: row.rewardCurrency || "USDm",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setMessage("Reward account created. Fund it below.");
      toast.push("Reward account created");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create failed";
      setError(msg);
      toast.push(msg);
    } finally {
      setBusy(false);
    }
  }

  async function pauseOrResume(action: "pause" | "resume") {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${row.groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setMessage(action === "pause" ? "Rewards paused." : "Rewards resumed.");
      toast.push(action === "pause" ? "Rewards paused" : "Rewards resumed", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function setOperator(event: FormEvent) {
    event.preventDefault();
    if (!row) return;
    const operator = operatorInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(operator)) {
      setError("Enter a valid 0x operator address");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("Updating Account Operator…");
    try {
      const res = await fetch(`/api/groups/${row.groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setOperator", operator }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Operator update failed");
      setMessage(`Operator updated to ${json.operator}. Billed to employment wallet.`);
      toast.push("Account Operator updated", "success");
      setOperatorInput("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Operator update failed";
      setError(msg);
      toast.push(msg);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function archiveAccount() {
    if (!row) return;
    if (!window.confirm("Archive this RewardAccount? Cash rewards will turn off.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${row.groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Archive failed");
      setMessage("RewardAccount archived. Billed to employment wallet.");
      toast.push("RewardAccount archived", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function fundAccount(event: FormEvent) {
    event.preventDefault();
    if (!row?.account?.address) return;
    const amountStr = fundAmount.trim();
    if (!amountStr || Number(amountStr) <= 0) {
      setError("Enter a positive fund amount");
      return;
    }
    const eth = getInjectedProvider();
    if (!eth || !isConnected) {
      toast.push("Connect a wallet in the header to fund.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("Submitting fund…");
    try {
      const payCurrency = fundCurrency;
      const transport = custom(eth as Parameters<typeof custom>[0]);
      const client = createWalletClient({ chain: celo, transport });
      const publicClient = createPublicClient({ chain: celo, transport });
      const [account] = connectedAddress
        ? [connectedAddress as Address]
        : await client.requestAddresses();
      const to = row.account.address as Address;
      let hash: Hash;
      if (payCurrency === "CELO") {
        hash = await client.sendTransaction({
          to,
          value: parseUnits(amountStr, 18),
          account,
          data: CELO_ATTRIBUTION_SUFFIX,
        });
      } else {
        const token = envToken(payCurrency);
        if (!token) throw new Error(`Token address missing for ${payCurrency}`);
        hash = await client.writeContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to, parseUnits(amountStr, tokenDecimals(payCurrency))],
          account,
          chain: celo,
          dataSuffix: CELO_ATTRIBUTION_SUFFIX,
        });
      }
      setMessage("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Fund transaction reverted");
      await refresh(true);
      const ok = "Reward account funded. Balance synced.";
      setMessage(ok);
      toast.push(ok, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fund failed";
      setError(msg);
      toast.push(msg);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={embedded ? "space-y-4" : "mt-6 max-w-lg space-y-4"}>
        <p className="text-sm text-muted font-medium">Loading reward accounts…</p>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "" : "mt-6"} max-w-lg space-y-6 animate-rise`}>
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-primary p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div className="space-y-2 max-w-xl text-left">
          <h1 className="text-xl font-black tracking-tight leading-tight">
            Reward Account Console
          </h1>
          <p className="text-[11px] text-white/80 leading-relaxed font-semibold">
            Fund member cash prizes separately from employment fees. Create a RewardAccount per
            group, sync the on-chain balance, then pause or resume payouts anytime.
          </p>
        </div>
        <div className="relative h-20 w-28 rounded-xl overflow-hidden border border-white/20 shrink-0">
          <Image
            src="/sentry_real_work.png"
            alt="Sentry engagement rewards"
            fill
            className="object-cover object-center"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-5 sm:p-6 space-y-3 border border-primary/10 shadow-sm text-center">
          <p className="text-sm font-bold text-text-dark">No groups yet</p>
          <p className="text-xs text-muted font-medium">
            Enable Sentry in a Telegram group, then create a reward account here.
          </p>
          <Link
            href="/groups"
            className="inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold text-white"
          >
            Go to Groups
          </Link>
        </div>
      ) : (
        <>
          <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
            <div className="flex items-center justify-between border-b border-primary/10 pb-3 gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Reward Account
              </p>
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 font-bold uppercase font-mono">
                {currency}
              </span>
            </div>

            <label className="block text-xs text-muted font-bold uppercase tracking-wider">
              Group
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  setMessage(null);
                  setError(null);
                  setShowQr(false);
                }}
                className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-semibold normal-case tracking-normal"
              >
                {rows.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName ?? g.telegramId}
                    {g.account ? "" : " (no account)"}
                  </option>
                ))}
              </select>
            </label>

            <p className="break-all font-mono text-[11px] font-bold text-text-dark bg-bg-light/60 border border-primary/10 rounded-lg p-3.5 leading-relaxed">
              {address ?? "Create a RewardAccount for this group to get a fund address"}
            </p>

            {hasAccount ? (
              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="rounded-full border border-primary/10 bg-white px-4 py-1.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition cursor-pointer shadow-sm"
                >
                  {copied ? "Address Copied" : "Copy Address"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  className="rounded-full border border-primary/10 bg-white px-4 py-1.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition cursor-pointer shadow-sm"
                >
                  {showQr ? "Hide QR" : "Display QR"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refresh(true)}
                  className="rounded-full border border-primary/10 bg-white px-4 py-1.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  Sync Balance
                </button>
                {row ? (
                  <Link
                    href={`/groups/${row.groupId}`}
                    className="rounded-full border border-primary/10 bg-white px-4 py-1.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition shadow-sm"
                  >
                    Group settings
                  </Link>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || !row?.factoryConfigured}
                onClick={() => void createAccount()}
                className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition cursor-pointer disabled:opacity-50"
              >
                {busy
                  ? "Creating…"
                  : row?.factoryConfigured
                    ? "Create RewardAccount"
                    : "RewardFactory not configured"}
              </button>
            )}

            {showQr && address ? (
              <div className="flex justify-center py-2 animate-rise">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(address)}`}
                  alt="Reward account QR code"
                  className="rounded-lg border border-primary/10 bg-white p-1.5 shadow-md"
                  width={140}
                  height={140}
                  unoptimized
                />
              </div>
            ) : null}
          </div>

          {hasAccount && row ? (
            <>
              <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted border-b border-primary/10 pb-2">
                  Balance & Reward Metrics
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(["CELO", "USDm", "USDC", "USDT"] as const).map((c) => {
                    const v =
                      balances?.[c] != null ? Number(balances[c]) : c === fundCurrency ? balance : 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFundCurrency(c)}
                        className={`rounded-lg border px-3 py-2 text-left transition cursor-pointer ${
                          fundCurrency === c
                            ? "border-primary bg-primary/5"
                            : "border-primary/10 hover:border-primary/30"
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                          {c}
                        </span>
                        <p className="font-black text-text-dark tabular-nums">
                          {Number.isFinite(v) ? v.toFixed(c === "CELO" ? 4 : 3) : "—"}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-primary/10">
                  <div className="space-y-0.5">
                    <p className="text-muted font-bold uppercase tracking-wider text-[10px]">
                      Cash rewards
                    </p>
                    <p className="text-text-dark font-bold text-sm">
                      {row.rewardPaused
                        ? "Paused"
                        : row.rewardEnabled
                          ? "On"
                          : "Off"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted font-bold uppercase tracking-wider text-[10px]">
                      Per point
                    </p>
                    <p className="text-primary font-bold font-mono text-sm">
                      {row.rewardAmountPerPoint} {row.rewardCurrency}
                    </p>
                  </div>
                  <div className="space-y-0.5 pt-2">
                    <p className="text-muted font-bold uppercase tracking-wider text-[10px]">
                      Account status
                    </p>
                    <p className="text-text-dark text-sm font-bold capitalize">
                      {row.account?.status ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5 pt-2">
                    <p className="text-muted font-bold uppercase tracking-wider text-[10px]">
                      Operator
                    </p>
                    <p className="text-text-dark font-mono text-[11px] font-bold break-all">
                      {row.operator ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
                <div className="flex border-b border-primary/10 pb-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("fund");
                      setMessage(null);
                      setError(null);
                    }}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                      activeTab === "fund"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-primary"
                    }`}
                  >
                    Fund Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("controls");
                      setMessage(null);
                      setError(null);
                    }}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                      activeTab === "controls"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-primary"
                    }`}
                  >
                    Controls
                  </button>
                </div>

                {activeTab === "fund" ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <p className="text-xs text-text-dark font-bold">
                        Option A: Injected Wallet Fund
                      </p>
                      <p className="text-xs text-muted font-medium">
                        Connect in the header, pick a token, then fund. Account holds CELO / USDm / USDC / USDT.
                      </p>
                      <form onSubmit={(e) => void fundAccount(e)} className="flex flex-wrap items-end gap-3 pt-1">
                        <label className="text-xs text-muted">
                          Token
                          <select
                            value={fundCurrency}
                            onChange={(e) =>
                              setFundCurrency(e.target.value as PaymentCurrency)
                            }
                            className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-bold"
                          >
                            <option value="CELO">CELO</option>
                            <option value="USDm">USDm</option>
                            <option value="USDC">USDC</option>
                            <option value="USDT">USDT</option>
                          </select>
                        </label>
                        <label className="flex-1 text-xs text-muted">
                          Fund Amount ({currency})
                          <input
                            value={fundAmount}
                            onChange={(e) => setFundAmount(e.target.value)}
                            className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy || !isConnected}
                          title={
                            isConnected
                              ? "Fund from connected wallet"
                              : "Connect wallet in the header first"
                          }
                          className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition cursor-pointer disabled:opacity-60"
                        >
                          Submit Fund
                        </button>
                      </form>
                    </div>
                    <div className="border-t border-primary/10 pt-4 space-y-1.5">
                      <p className="text-xs text-text-dark font-bold">
                        Option B: Direct Ledger Transfer
                      </p>
                      <p className="text-xs text-muted leading-relaxed font-medium">
                        Send accepted tokens directly to the reward address above. Once the tx
                        completes, tap <strong className="text-text-dark font-extrabold">Sync Balance</strong>.
                        Do not send to your employment wallet.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted leading-relaxed font-medium">
                      Pause/resume and setAccountOperator run on-chain via Sentry and bill your
                      employment wallet. Factory-wide admin (global operator, currencies) is out of
                      scope.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void pauseOrResume(row.rewardPaused ? "resume" : "pause")
                        }
                        className="rounded-full border border-primary/10 bg-white px-5 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {row.rewardPaused ? "Resume rewards" : "Pause rewards"}
                      </button>
                      <Link
                        href={`/groups/${row.groupId}`}
                        className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition"
                      >
                        Edit rates & points
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void archiveAccount()}
                        className="rounded-full border border-alert/30 bg-white px-5 py-2.5 text-xs font-bold text-alert hover:bg-alert/5 transition cursor-pointer disabled:opacity-50"
                      >
                        Archive account
                      </button>
                    </div>
                    <form
                      onSubmit={(e) => void setOperator(e)}
                      className="border-t border-primary/10 pt-4 space-y-3"
                    >
                      <p className="text-xs text-text-dark font-bold">Set Account Operator</p>
                      <p className="text-xs text-muted font-medium">
                        Current:{" "}
                        <span className="font-mono text-text-dark">
                          {row.operator ?? "unknown"}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex-1 text-xs text-muted min-w-[200px]">
                          New operator (0x…)
                          <input
                            value={operatorInput}
                            onChange={(e) => setOperatorInput(e.target.value)}
                            placeholder="0x…"
                            className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                        >
                          Update operator
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      )}

      {message ? (
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-slate-900 font-bold animate-rise">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-alert/25 bg-alert/10 px-4 py-3 text-xs text-alert font-bold animate-rise">
          {error}
        </div>
      ) : null}
    </div>
  );
}
