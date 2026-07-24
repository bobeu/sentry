"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useDisconnect } from "wagmi";
import { isFarcaster, isMiniPay } from "@/lib/wagmi";

/**
 * Themed RainbowKit connect control with an explicit disconnect action.
 * Compact for the site header.
 */
export function WalletConnectButton({
  compact = true,
}: {
  compact?: boolean;
}) {
  const [implicit, setImplicit] = useState(false);
  const { disconnectAsync, isPending: disconnecting } = useDisconnect();

  useEffect(() => {
    setImplicit(isMiniPay() || isFarcaster());
  }, []);

  if (implicit) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary">
        <span className="status-pulse h-1.5 w-1.5 rounded-full bg-primary" />
        MiniPay
      </span>
    );
  }

  async function handleDisconnect() {
    try {
      await disconnectAsync();
    } catch (err) {
      console.error("[wallet] disconnect failed", err);
    }
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
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary/90"
                  >
                    Connect wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-bold text-text-dark"
                  >
                    Switch to Celo
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1.5">
                  {!compact ? (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="rounded-xl border border-primary/15 bg-white px-2.5 py-1.5 text-xs font-bold text-text-dark transition hover:border-primary/40"
                    >
                      {chain.hasIcon && chain.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={chain.name ?? "Chain"}
                          src={chain.iconUrl}
                          className="h-4 w-4"
                          style={{ background: chain.iconBackground }}
                        />
                      ) : (
                        chain.name
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openAccountModal}
                    title="Wallet details"
                    className="rounded-xl border border-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-text-dark transition hover:border-primary hover:text-primary shadow-sm"
                  >
                    {account.displayName}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    disabled={disconnecting}
                    title="Disconnect wallet"
                    aria-label="Disconnect wallet"
                    className={
                      compact
                        ? "inline-flex min-h-8 min-w-8 items-center justify-center rounded-xl border border-primary/15 bg-white px-2 py-1.5 text-xs font-bold text-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:opacity-60"
                        : "rounded-xl border border-primary/15 bg-white px-2.5 py-1.5 text-xs font-bold text-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:opacity-60"
                    }
                  >
                    {disconnecting ? (
                      "…"
                    ) : compact ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                        <path
                          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      "Disconnect"
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
