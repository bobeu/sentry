"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { celo } from "wagmi/chains";
import { wagmiConfig } from "@/lib/wagmi";
import { ToastProvider } from "@/components/Toast";
import { MiniPayAutoConnect } from "@/components/MiniPayAutoConnect";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[var(--bg)]" />;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={celo}
          showRecentTransactions
          theme={lightTheme({
            accentColor: "#35d07f",
            accentColorForeground: "#061008",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          <ToastProvider>
            <MiniPayAutoConnect />
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
