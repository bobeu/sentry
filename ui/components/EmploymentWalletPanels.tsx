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
        {!employment ? (
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-full border border-white/20 bg-[#101510] px-4 py-2.5 text-sm"
            aria-label="Wallet currency"
          >
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
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
  const [, setError] = useState<string | null>(null);
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
    <div className="mt-6 max-w-lg">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9aa89a]">Employment Wallet</p>
        <p className="mt-2 break-all font-mono text-sm text-[#e8f5d8]">
          {address ?? "Hire Sentry to provision your wallet"}
        </p>

        {address ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAddress}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
            >
              {showQr ? "Hide QR" : "QR Code"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={manualSync}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
            >
              Sync Balance
            </button>
          </div>
        ) : null}

        {showQr && address ? (
          <Image
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(address)}`}
            alt="Wallet QR code"
            className="mt-3 rounded-lg border border-white/10 bg-white p-1.5"
            width={140}
            height={140}
            unoptimized
          />
        ) : null}

        <div className="my-4 border-t border-white/10" />

        <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#9aa89a]">
          Funding Methods
        </p>
        <ol className="mt-3 space-y-3 text-sm text-[#b7c4b5]">
          <li>
            <span className="text-[#e8f5d8]">① Deposit from Connected Wallet</span>
            <div className="mt-2">
              <WalletConnectButton />
            </div>
            {address && depositConfig ? (
              <form onSubmit={webDeposit} className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs text-[#9aa89a]">
                  Amount
                  <input
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="mt-1 block w-28 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#35d07f]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || !isConnected}
                  className="rounded-full bg-[#35d07f] px-4 py-2 text-xs font-semibold text-[#061008] disabled:opacity-60"
                >
                  Deposit
                </button>
              </form>
            ) : (
              <p className="mt-1 text-xs">Hire Sentry to enable web deposit.</p>
            )}
          </li>
          <li>
            <span className="text-[#e8f5d8]">② Send Funds Directly</span>
            <p className="mt-1 text-xs">
              Transfer to the address above, then tap Sync Balance.
            </p>
          </li>
        </ol>

        <div className="my-4 border-t border-white/10" />

        <p className="text-xs uppercase tracking-[0.15em] text-[#9aa89a]">Accepted Currency</p>
        <p className="mt-1 text-sm text-[#e8f5d8]">{currency}</p>

        <div className="my-4 border-t border-white/10" />

        <p className="text-xs uppercase tracking-[0.15em] text-[#9aa89a]">Current Balance</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[#f4f7f0]">
          {balance.toFixed(4)} <span className="text-lg text-[#9aa89a]">{currency}</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[#9aa89a]">Outstanding</p>
            <p className="text-[#e8f5d8]">{outstanding.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-[#9aa89a]">Withdrawable</p>
            <p className="text-[#e8f5d8]">{withdrawable.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-[#9aa89a]">Settlement</p>
            <p className="text-[#e8f5d8]">{settlementStatus}</p>
          </div>
          <div>
            <p className="text-xs text-[#9aa89a]">Last Settlement</p>
            <p className="text-[#e8f5d8]">
              {lastSettlementAt ? new Date(lastSettlementAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {address ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-[#9aa89a]">
                Withdrawal destination
                <input
                  value={withdrawalAddress}
                  onChange={(event) => setWithdrawalAddress(event.target.value)}
                  placeholder="0x…"
                  className="mt-1 block w-72 rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-[#35d07f]"
                />
              </label>
              <button
                type="button"
                onClick={saveDestination}
                disabled={loading}
                className="rounded-full border border-white/20 px-4 py-2 text-xs disabled:opacity-40"
              >
                Save pending
              </button>
              {pendingWithdrawalAddress ? (
                <button
                  type="button"
                  onClick={confirmDestination}
                  disabled={loading}
                  className="rounded-full bg-[#35d07f] px-4 py-2 text-xs font-semibold text-[#061008] disabled:opacity-40"
                >
                  Confirm destination
                </button>
              ) : null}
            </div>
            {pendingWithdrawalAddress ? (
              <p className="text-xs text-amber-200">
                Pending confirmation: {pendingWithdrawalAddress}
              </p>
            ) : null}
            <form onSubmit={withdraw} className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[#9aa89a]">
              Withdraw (max {withdrawable.toFixed(4)})
              <input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="mt-1 block w-28 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#35d07f]"
              />
            </label>
            <button
              type="submit"
              disabled={loading || withdrawable <= 0}
              className="rounded-full border border-white/20 px-4 py-2 text-xs disabled:opacity-40"
            >
              Withdraw
            </button>
            </form>
          </div>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-sm text-[#35d07f]">{message}</p> : null}
    </div>
  );
}
