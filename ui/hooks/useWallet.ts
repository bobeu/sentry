"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { injected } from "wagmi/connectors";
import { isMiniPay } from "@/lib/wagmi";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [isReady, setIsReady] = useState(false);

  const miniPayDetected = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isMiniPay();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || isConnected || isConnecting || typeof window === "undefined") {
      return;
    }
    if (!(window as unknown as { ethereum?: unknown }).ethereum) return;
    if (!miniPayDetected) return;

    const miniPayConnector = injected({ target: "metaMask" });
    connectAsync({ connector: miniPayConnector }).catch((err: unknown) => {
      console.error("Auto-connect MiniPay failed:", err);
    });
  }, [isReady, isConnected, isConnecting, connectAsync, miniPayDetected]);

  const connectWallet = async (connectorId?: string) => {
    const targetConnector = connectorId
      ? connectors.find((c) => c.id === connectorId)
      : connectors.find((c) => c.id === "injected") || connectors[0];
    if (!targetConnector) {
      throw new Error("No wallet connector available");
    }
    await connectAsync({ connector: targetConnector });
  };

  const disconnectWallet = async () => {
    await disconnectAsync();
  };

  const formatAddress = (value?: string) => {
    if (!value) return "";
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  };

  return {
    address,
    isConnected,
    isConnecting,
    isReady,
    miniPayDetected,
    connectWallet,
    disconnectWallet,
    formatAddress,
    connectors,
  };
}
