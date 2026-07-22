"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { isFarcaster, isMiniPay } from "@/lib/wagmi";

/**
 * Themed RainbowKit connect control. Compact for the site header.
 */
export function WalletConnectButton({
  compact = true,
}: {
  compact?: boolean;
}) {
  const [implicit, setImplicit] = useState(false);

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
                    className="rounded-xl border border-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-text-dark transition hover:border-primary hover:text-primary shadow-sm"
                  >
                    {account.displayName}
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
