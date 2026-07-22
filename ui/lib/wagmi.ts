import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { celo } from "wagmi/chains";

export const isMiniPay = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum
      ?.isMiniPay,
  );
};

export const isFarcaster = (): boolean => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  return (
    userAgent.includes("farcaster") ||
    urlParams.has("farcaster") ||
    urlParams.get("mode") === "farcaster" ||
    Boolean((window as unknown as { farcaster?: unknown }).farcaster)
  );
};

export const getInjectedProvider = () => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: unknown }).ethereum;
};

const rpc =
  process.env.NEXT_PUBLIC_ALCHEMY_CELO_MAINNET_API?.trim() ||
  "https://forno.celo.org";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID?.trim() ||
  "444e8c9b1c9d0a1e5f2b2c3d4e5f6a7";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://sentry-sigma-two.vercel.app";

export const wagmiConfig = getDefaultConfig({
  appName: "Sentry",
  projectId,
  appDescription: "AI employee for Telegram communities on Celo",
  appUrl,
  appIcon: `${appUrl.replace(/\/$/, "")}/logo.png`,
  chains: [celo],
  ssr: true,
  multiInjectedProviderDiscovery: true,
  transports: {
    [celo.id]: http(rpc),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
