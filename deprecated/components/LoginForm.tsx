"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { isMiniPay, isFarcaster } from "@/lib/wagmi";

export function LoginForm() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [implicitWallet, setImplicitWallet] = useState(false);

  useEffect(() => {
    setImplicitWallet(isMiniPay() || isFarcaster());
  }, []);

  const walletReady = (isConnected && Boolean(address)) || implicitWallet;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!address && !implicitWallet) {
        throw new Error("Connect your Celo wallet before continuing.");
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          walletAddress: address ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          1. Connect Celo wallet
        </p>
        <p className="text-[11px] text-muted leading-relaxed">
          Used to fund your prepaid employment wallet and receive withdrawals.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/15 bg-bg-light/60 px-3 py-3">
          <WalletConnectButton compact={false} />
          {walletReady ? (
            <span className="text-[11px] font-bold text-primary">Ready</span>
          ) : (
            <span className="text-[11px] text-muted">Required</span>
          )}
        </div>
      </div>

      <label className="block text-xs font-bold uppercase tracking-wider text-muted">
        2. Work email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2.5 w-full rounded-xl border border-primary/20 bg-white px-4 py-3 text-text-dark outline-none focus:border-primary transition text-sm font-normal placeholder:text-muted/60"
          placeholder="you@company.com"
        />
        <span className="mt-1.5 block text-[11px] font-medium normal-case tracking-normal text-muted leading-relaxed">
          Identifies your Sentry employment account (on-chain wallet is keyed to
          email). Use the same email to sign back in.
        </span>
      </label>

      {error ? (
        <p className="text-xs text-alert font-bold bg-alert/10 border border-alert/20 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !email || !walletReady}
        className="w-full rounded-xl bg-primary px-6 py-3.5 text-xs font-bold text-white shadow hover:bg-primary/95 cursor-pointer disabled:opacity-60 transition"
      >
        {loading ? "Signing in…" : "Sign in / Create account"}
      </button>

      <p className="text-[11px] text-center text-muted leading-relaxed">
        After you sign in, use Connect in the header only when you need to deposit
        or switch accounts.
      </p>
    </form>
  );
}
