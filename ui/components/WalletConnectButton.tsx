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
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary">
        <span className="status-pulse h-1.5 w-1.5 rounded-full bg-primary" />
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
            className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-bold text-text-dark"
          >
            Switch to Celo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-text-dark transition hover:border-primary hover:text-primary shadow-sm"
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
        className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-60 shadow-sm"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-xl">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              className="block w-full px-4 py-2.5 text-left text-xs font-bold text-text-dark transition hover:bg-primary/5 hover:text-primary"
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

