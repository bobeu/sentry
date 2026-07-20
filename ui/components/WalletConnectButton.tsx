"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isFarcaster, isMiniPay } from "@/lib/wagmi";

export function WalletConnectButton() {
  const [implicit, setImplicit] = useState(false);

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

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {!connected ? (
              <button
                type="button"
                onClick={openConnectModal}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#061008] transition hover:brightness-110"
              >
                Connect wallet
              </button>
            ) : chain.unsupported ? (
              <button
                type="button"
                onClick={openChainModal}
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-100"
              >
                Switch to Celo
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountModal}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#e8f5d8] transition hover:border-[var(--accent)]/40"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
