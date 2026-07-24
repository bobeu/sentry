"use client";

import { useCallback, useEffect, useState } from "react";
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
  rewardEnabled: boolean;
  rewardPaused: boolean;
  rewardAmountPerPoint: string;
  rewardCurrency: string;
  balance?: string | null;
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
  // Client: only NEXT_PUBLIC_* is available; fall back to known mainnet defaults if unset.
  const defaults: Record<string, string> = {
    USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD / Mento Dollar commonly used as USDm
    USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  };
  const raw = (map[currency] || defaults[currency] || "").trim();
  return raw.startsWith("0x") ? (raw as Address) : null;
}

export function RewardsPanel() {
  const toast = useToast();
  const { isConnected, address: connectedAddress } = useAccount();
  const [rows, setRows] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/rewards/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load rewards");
      setRows(json.groups ?? []);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not load rewards");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(groupId: string, currency?: string) {
    setBusyId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure", currency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.push("Reward account created");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function pauseOrResume(groupId: string, action: "pause" | "resume") {
    setBusyId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.push(action === "pause" ? "Rewards paused" : "Rewards resumed");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      toast.push("Reward address copied");
    } catch {
      toast.push(address);
    }
  }

  async function fundAccount(row: RewardRow) {
    if (!row.account?.address) return;
    const amountStr = (fundAmount[row.groupId] ?? "").trim();
    if (!amountStr || Number(amountStr) <= 0) {
      toast.push("Enter a positive fund amount");
      return;
    }
    const eth = getInjectedProvider();
    if (!eth || !isConnected) {
      toast.push("Connect a wallet to fund");
      return;
    }
    const currency = (row.account.currency || row.rewardCurrency || "USDm") as PaymentCurrency;
    setBusyId(row.groupId);
    try {
      const transport = custom(eth as Parameters<typeof custom>[0]);
      const client = createWalletClient({ chain: celo, transport });
      const publicClient = createPublicClient({ chain: celo, transport });
      const [account] = connectedAddress
        ? [connectedAddress as Address]
        : await client.requestAddresses();
      const to = row.account.address as Address;
      let hash: Hash;
      if (currency === "CELO") {
        hash = await client.sendTransaction({
          to,
          value: parseUnits(amountStr, 18),
          account,
          data: CELO_ATTRIBUTION_SUFFIX,
        });
      } else {
        const token = envToken(currency);
        if (!token) throw new Error(`Token address missing for ${currency}`);
        hash = await client.writeContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to, parseUnits(amountStr, tokenDecimals(currency))],
          account,
          chain: celo,
          dataSuffix: CELO_ATTRIBUTION_SUFFIX,
        });
      }
      toast.push("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Fund transaction reverted");
      toast.push("Reward account funded");
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Fund failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
        <p className="text-sm text-muted font-medium">Loading rewards…</p>
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Engagement payouts
          </p>
          <h2 className="text-xl font-black text-text-dark sm:text-2xl">
            Reward accounts
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted font-semibold leading-relaxed">
            Separate from your employment wallet. Create a RewardAccount per group, fund it, then
            members earn points and withdraw by tagging Sentry with their 0x address.
          </p>
        </div>
        <Link
          href="/groups"
          className="rounded-full border border-primary/20 bg-white px-4 py-2 text-xs font-bold text-text-dark hover:border-primary hover:text-primary transition shadow-sm"
        >
          Open groups
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-sm font-semibold text-text-dark">No groups yet</p>
          <p className="mt-1 text-xs text-muted">
            Enable Sentry in a Telegram group, then create a reward account here.
          </p>
          <Link
            href="/groups"
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold text-white"
          >
            Go to Groups
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => {
            const busy = busyId === row.groupId;
            const hasAccount = Boolean(row.account?.address);
            return (
              <article
                key={row.groupId}
                className="rounded-2xl border border-primary/10 bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-text-dark">
                      {row.groupName ?? row.telegramId}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {hasAccount
                        ? `${row.account!.status} · ${row.account!.currency}`
                        : "No reward account"}
                      {row.rewardPaused ? " · paused" : row.rewardEnabled ? " · cash on" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/groups/${row.groupId}`}
                    className="shrink-0 text-[10px] font-bold uppercase text-primary hover:underline"
                  >
                    Settings
                  </Link>
                </div>

                {hasAccount ? (
                  <>
                    <div className="rounded-xl bg-slate-50 border border-primary/10 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-muted">Fund address</p>
                      <p className="mt-0.5 break-all font-mono text-[11px] font-semibold text-text-dark">
                        {row.account!.address}
                      </p>
                      {row.balance != null ? (
                        <p className="mt-1 text-xs font-bold text-primary">
                          On-chain ≈ {Number(row.balance).toFixed(4)} {row.account!.currency}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyAddress(row.account!.address)}
                        className="rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-bold text-text-dark"
                      >
                        Copy
                      </button>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Amount"
                        value={fundAmount[row.groupId] ?? ""}
                        onChange={(e) =>
                          setFundAmount((s) => ({ ...s, [row.groupId]: e.target.value }))
                        }
                        className="min-w-0 flex-1 rounded-xl border border-primary/15 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={busy || !isConnected}
                        onClick={() => void fundAccount(row)}
                        title={isConnected ? "Fund from connected wallet" : "Connect wallet in the header first"}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Fund
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void pauseOrResume(
                            row.groupId,
                            row.rewardPaused ? "resume" : "pause",
                          )
                        }
                        className="rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-bold text-text-dark hover:border-primary"
                      >
                        {row.rewardPaused ? "Resume" : "Pause"}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !row.factoryConfigured}
                    onClick={() =>
                      void createAccount(row.groupId, row.rewardCurrency || "USDm")
                    }
                    className="w-full rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm disabled:opacity-50"
                  >
                    {busy
                      ? "Creating…"
                      : row.factoryConfigured
                        ? "Create RewardAccount"
                        : "RewardFactory not configured"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
