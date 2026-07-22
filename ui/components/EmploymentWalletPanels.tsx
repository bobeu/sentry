"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { celo } from "viem/chains";
import { useAccount } from "wagmi";
import { CELO_ATTRIBUTION_SUFFIX } from "@/lib/attribution";
import { tokenDecimals, type PaymentCurrency } from "@/lib/payment-currency";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useToast } from "@/components/Toast";
import { getInjectedProvider } from "@/lib/wagmi";

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
  const [currency, setCurrency] = useState("USDm");
  const [currencies, setCurrencies] = useState<string[]>(["USDm"]);

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
    void fetch("/api/payment/currency")
      .then((res) => res.json())
      .then((json) => {
        const enabled = (json.currencies ?? [])
          .filter((item: { enabled: boolean }) => item.enabled)
          .map((item: { currency: string }) => item.currency);
        if (enabled.length) {
          setCurrencies(enabled);
          setCurrency(enabled.includes("USDm") ? "USDm" : enabled[0]);
        }
      });
  }, []);

  async function run(path: string) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: path.endsWith("/start") ? JSON.stringify({ currency }) : undefined,
      });
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
    <div className="mt-8 max-w-xl space-y-6 animate-rise">
      <div className="surface-card p-6 border border-primary/10 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">EMPLOYMENT CREDENTIAL</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-2xl font-black text-text-dark">
            {status === "Active" ? (
              <span className="text-[#00D283] flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-[#00D283] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00D283]"></span>
                </span>
                Active Duty
              </span>
            ) : status === "Paused" ? (
              <span className="text-warning flex items-center gap-2">⏸ Paused</span>
            ) : (
              <span className="text-muted flex items-center gap-2">Inactive</span>
            )}
          </p>
          {employment?.startedAt && (
            <span className="text-[10px] text-muted bg-bg-light/60 border border-primary/10 rounded px-2.5 py-1 font-bold font-mono">
              Started {new Date(employment.startedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!employment && (
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-full border border-primary/15 bg-white px-4 py-2.5 text-xs font-bold text-text-dark focus:border-primary outline-none cursor-pointer shadow-sm"
            aria-label="Wallet currency"
          >
            {currencies.map((item) => (
              <option key={item} value={item} className="bg-white text-text-dark">
                {item}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => run("/api/employment/start")}
          className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/95 cursor-pointer disabled:opacity-60 transition"
        >
          Hire Sentry
        </button>
        <button
          type="button"
          disabled={loading || status !== "Active"}
          onClick={() => run("/api/employment/pause")}
          className="rounded-full border border-primary/10 bg-white px-6 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
        >
          Pause
        </button>
        <button
          type="button"
          disabled={loading || status !== "Paused"}
          onClick={() => run("/api/employment/resume")}
          className="rounded-full border border-primary/10 bg-white px-6 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
        >
          Resume
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-slate-900 font-bold">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-alert/25 bg-alert/10 px-4 py-3 text-xs text-alert font-bold">
          {error}
        </div>
      )}

      {/* Visual illustration banner for real work */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm group">
        <div className="relative h-48 w-full overflow-hidden">
          <Image src="/sentry_real_work.png" alt="Sentry Active Labor & Verification" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/95" />
        </div>
        <div className="px-5 pb-5 pt-2">
          <h3 className="text-sm font-black text-text-dark">Sentry Verification & Labor Logs</h3>
          <p className="mt-1 text-xs text-muted font-medium leading-relaxed">Proof of Work hashes, automated Telegram responses, and settlement events are all transparently recorded on-chain, proving actual labor performed.</p>
        </div>
      </div>
    </div>
  );
}

type DepositConfig = {
  employmentWallet: string;
  currency: string;
  tokenAddress: string | null;
  methodA: { type: "native-transfer" | "erc20-transfer" };
};

const DEPOSIT_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function WalletPanel() {
  const { isConnected, address: connectedAddress } = useAccount();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [withdrawable, setWithdrawable] = useState(0);
  const [lastSettlementAt, setLastSettlementAt] = useState<string | null>(null);
  const [settlementStatus, setSettlementStatus] = useState<string>("—");
  const [currency, setCurrency] = useState("USDm");
  const [depositAmount, setDepositAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [withdrawalAddress, setWithdrawalAddress] = useState("");
  const [pendingWithdrawalAddress, setPendingWithdrawalAddress] = useState<string | null>(null);
  const [depositConfig, setDepositConfig] = useState<DepositConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [balRes, prepareRes, spendRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/wallet/deposit/prepare"),
      fetch("/api/billing/spending"),
    ]);
    const balJson = await balRes.json();
    if (!balRes.ok) {
      setError(balJson.error ?? "Failed to load wallet");
      return;
    }
    setAddress(balJson.address);
    setBalance(balJson.onChainBalance ?? balJson.balance ?? 0);
    setOutstanding(balJson.outstandingCharges ?? 0);
    setWithdrawable(balJson.withdrawableBalance ?? balJson.availableBalance ?? 0);
    setCurrency(balJson.currency ?? "USDm");
    setWithdrawalAddress(
      balJson.pendingWithdrawalAddress ?? balJson.withdrawalAddress ?? "",
    );
    setPendingWithdrawalAddress(balJson.pendingWithdrawalAddress ?? null);
    setError(null);

    if (spendRes.ok) {
      const spend = await spendRes.json();
      setLastSettlementAt(spend.settlement?.lastSettlementAt ?? null);
      const failed = spend.settlement?.failedSettlement;
      const triggers = spend.settlement?.nextSettlement?.triggers;
      if (failed) setSettlementStatus("Retry pending");
      else if (triggers?.monetary || triggers?.actions || triggers?.time)
        setSettlementStatus("Ready to settle");
      else if ((spend.outstandingCharges ?? 0) > 0) setSettlementStatus("Accumulating");
      else setSettlementStatus("Up to date");
    }

    if (prepareRes.ok) {
      setDepositConfig(await prepareRes.json());
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

  async function syncBalance(notify = true) {
    const res = await fetch("/api/wallet/sync", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Sync failed");
    setBalance(Number(json.balance));
    setCurrency(json.currency ?? currency);
    if (notify) {
      setMessage(`Balance updated: ${Number(json.balance).toFixed(4)} ${json.currency}`);
    }
    window.dispatchEvent(new CustomEvent("sentry:wallet-updated"));
    return json;
  }

  async function manualSync() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await syncBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  async function webDeposit(event: FormEvent) {
    event.preventDefault();
    if (!depositConfig) {
      toast.push("Wallet deposit configuration is unavailable.");
      return;
    }
    const eth = getInjectedProvider();
    if (!eth || !isConnected) {
      toast.push("Connect a Web3 wallet (MetaMask / MiniPay) to deposit.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage("Submitting deposit…");
    try {
      const transport = custom(eth as Parameters<typeof custom>[0]);
      const client = createWalletClient({ chain: celo, transport });
      const publicClient = createPublicClient({ chain: celo, transport });
      const [account] = connectedAddress
        ? [connectedAddress as Address]
        : await client.requestAddresses();
      const employmentWallet = depositConfig.employmentWallet as Address;

      let hash: Hash;
      if (depositConfig.currency === "CELO") {
        const amount = parseEther(depositAmount);
        hash = await client.sendTransaction({
          to: employmentWallet,
          value: amount,
          account,
          data: CELO_ATTRIBUTION_SUFFIX,
        });
      } else {
        if (!depositConfig.tokenAddress) throw new Error("Token address is not configured");
        const amount = parseUnits(
          depositAmount,
          tokenDecimals(depositConfig.currency as PaymentCurrency),
        );
        hash = await client.writeContract({
          address: depositConfig.tokenAddress as Address,
          abi: DEPOSIT_ABI,
          functionName: "transfer",
          args: [employmentWallet, amount],
          account,
          chain: celo,
          dataSuffix: CELO_ATTRIBUTION_SUFFIX,
        });
      }

      setMessage("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Deposit transaction reverted");

      const synced = await syncBalance(false);
      const ok = `Deposit confirmed. Balance is now ${Number(synced.balance).toFixed(4)} ${synced.currency ?? currency} (synced automatically).`;
      setMessage(ok);
      toast.push(ok, "success");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deposit failed";
      setError(msg);
      toast.push(msg);
      setMessage(null);
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
      setMessage(`Withdrawal recorded. Balance ${Number(json.balance).toFixed(4)} ${json.currency}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveDestination() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/destination", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalAddress }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Destination update failed");
      setPendingWithdrawalAddress(json.pendingWithdrawalAddress ?? withdrawalAddress);
      setMessage("Pending destination saved. Confirm it before withdrawing.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Destination update failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDestination() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/destination", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Confirmation failed");
      setPendingWithdrawalAddress(null);
      setWithdrawalAddress(json.withdrawalAddress ?? "");
      setMessage("Withdrawal destination confirmed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 max-w-lg space-y-6 animate-rise">
      {/* Wallet Banner */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-primary p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div className="space-y-2 max-w-xl text-left">
          <h1 className="text-xl font-black tracking-tight leading-tight">Employment Wallet Console</h1>
          <p className="text-[11px] text-white/80 leading-relaxed font-semibold">
            Fund your employee&apos;s on-chain Celo wallet to execute smart contract operations, query data API logs, and settle automated task balances.
          </p>
        </div>
        <div className="relative h-20 w-28 rounded-xl overflow-hidden border border-white/20 shrink-0">
          <Image src="/sentry_real_work.png" alt="Sentry Audited Work" fill className="object-cover object-center" />
        </div>
      </div>

      {/* Address console */}
      <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary/10 pb-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Employment Wallet</p>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 font-bold uppercase font-mono">
            {currency}
          </span>
        </div>
        <p className="break-all font-mono text-[11px] font-bold text-text-dark bg-bg-light/60 border border-primary/10 rounded-lg p-3.5 leading-relaxed">
          {address ?? "Hire Sentry to provision your wallet"}
        </p>

        {address && (
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={copyAddress}
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
              disabled={loading}
              onClick={manualSync}
              className="rounded-full border border-primary/10 bg-white px-4 py-1.5 text-xs font-bold text-text-dark hover:bg-slate-100 transition cursor-pointer shadow-sm"
            >
              Sync Balance
            </button>
          </div>
        )}

        {showQr && address && (
          <div className="flex justify-center py-2 animate-rise">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(address)}`}
              alt="Wallet QR code"
              className="rounded-lg border border-primary/10 bg-white p-1.5 shadow-md"
              width={140}
              height={140}
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Telemetry data */}
      <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted border-b border-primary/10 pb-2">
          Balance & Spend Metrics
        </h3>
        <p className="text-3xl font-black text-text-dark">
          {balance.toFixed(4)} <span className="text-lg text-muted font-bold font-sans">{currency}</span>
        </p>

        <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-primary/10">
          <div className="space-y-0.5">
            <p className="text-muted font-bold uppercase tracking-wider text-[10px]">Outstanding</p>
            <p className="text-text-dark font-bold font-mono text-sm">{outstanding.toFixed(4)} {currency}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted font-bold uppercase tracking-wider text-[10px]">Withdrawable</p>
            <p className="text-primary font-bold font-mono text-sm">{withdrawable.toFixed(4)} {currency}</p>
          </div>
          <div className="space-y-0.5 pt-2">
            <p className="text-muted font-bold uppercase tracking-wider text-[10px]">Settlement Stage</p>
            <p className="text-text-dark text-sm font-bold">{settlementStatus}</p>
          </div>
          <div className="space-y-0.5 pt-2">
            <p className="text-muted font-bold uppercase tracking-wider text-[10px]">Settled At</p>
            <p className="text-text-dark font-bold font-mono text-sm leading-none">
              {lastSettlementAt ? new Date(lastSettlementAt).toLocaleDateString() : "None yet"}
            </p>
          </div>
        </div>
      </div>

      {/* Action panel (deposit / withdraw tabs) */}
      {address && (
        <div className="surface-card p-5 sm:p-6 space-y-4 border border-primary/10 shadow-sm">
          <div className="flex border-b border-primary/10 pb-2 gap-4">
            <button
              onClick={() => { setActiveTab("deposit"); setMessage(null); setError(null); }}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                activeTab === "deposit" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
              }`}
            >
              Deposit Funds
            </button>
            <button
              onClick={() => { setActiveTab("withdraw"); setMessage(null); setError(null); }}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                activeTab === "withdraw" ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
              }`}
            >
              Withdraw Funds
            </button>
          </div>

          {activeTab === "deposit" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-xs text-text-dark font-bold">Option A: Injected Wallet Deposit</p>
                <div className="flex items-center gap-3">
                  <WalletConnectButton />
                </div>
                {depositConfig ? (
                  <form onSubmit={webDeposit} className="flex flex-wrap items-end gap-3 pt-1">
                    <label className="flex-1 text-xs text-muted">
                      Deposit Amount ({currency})
                      <input
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={loading || !isConnected}
                      className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition cursor-pointer disabled:opacity-60"
                    >
                      Submit Deposit
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-muted italic">Hire Sentry first to initialize deposits.</p>
                )}
              </div>

              <div className="border-t border-primary/10 pt-4 space-y-1.5">
                <p className="text-xs text-text-dark font-bold">Option B: Direct Ledger Transfer</p>
                <p className="text-xs text-muted leading-relaxed font-medium">
                  Send accepted ERC-20 / Native Celo tokens directly to the contract address listed at the top. Once the tx completes, tap the <strong className="text-text-dark font-extrabold">Sync Balance</strong> button above.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="block text-xs text-muted">
                  Saved Withdrawal Destination Address
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={withdrawalAddress}
                      onChange={(event) => setWithdrawalAddress(event.target.value)}
                      placeholder="0x..."
                      className="flex-1 min-w-[200px] rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={saveDestination}
                      disabled={loading}
                      className="rounded-full border border-primary/10 bg-white px-4 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 disabled:opacity-50 cursor-pointer transition shadow-sm"
                    >
                      Save Destination
                    </button>
                  </div>
                </label>

                {pendingWithdrawalAddress && (
                  <div className="p-3.5 rounded-lg border border-warning/25 bg-warning/5 flex flex-col gap-2.5">
                    <p className="text-xs text-warning leading-relaxed font-semibold">
                      Confirm pending withdrawal route: <br />
                      <strong className="font-mono text-text-dark break-all font-bold">{pendingWithdrawalAddress}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={confirmDestination}
                      disabled={loading}
                      className="self-end rounded-full bg-accent px-5 py-2 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition cursor-pointer"
                    >
                      Confirm Route
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={withdraw} className="border-t border-primary/10 pt-4 flex flex-wrap items-end gap-3.5">
                <label className="flex-1 text-xs text-muted">
                  Withdraw Amount (Max: {withdrawable.toFixed(4)})
                  <input
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || withdrawable <= 0}
                  className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/90 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Withdraw
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-slate-900 font-bold animate-rise">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-alert/25 bg-alert/10 px-4 py-3 text-xs text-alert font-bold animate-rise">
          {error}
        </div>
      )}
    </div>
  );
}
