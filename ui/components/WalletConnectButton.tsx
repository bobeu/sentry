"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { isFarcaster, isMiniPay } from "@/lib/wagmi";

export function WalletConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [implicit, setImplicit] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setImplicit(isMiniPay() || isFarcaster());
  }, []);

  if (implicit) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
        <span className="status-pulse h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        MiniPay connected
      </span>
    );
  }

  if (isConnected && address) {
    const wrongChain = chain && chain.id !== celo.id;
    return (
      <div className="flex items-center gap-2">
        {wrongChain ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: celo.id })}
            className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100"
          >
            Switch to Celo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#e8f5d8] transition hover:border-[var(--accent)]/40"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#061008] transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-white/15 bg-[#101610] shadow-xl">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm text-[#e8f5d8] transition hover:bg-white/5"
              onClick={() => {
                connect({ connector, chainId: celo.id });
                setOpen(false);
              }}
            >
              {connector.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
