"use client";

import { useWallet } from "@/hooks/useWallet";

/** Mount once under RainbowKit to auto-connect MiniPay. */
export function MiniPayAutoConnect() {
  useWallet();
  return null;
}
