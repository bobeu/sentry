import { http, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

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
  "00000000000000000000000000000000";

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: "Sentry",
        description: "AI employee for Telegram communities on Celo",
        url:
          process.env.NEXT_PUBLIC_APP_URL?.trim() ||
          "https://sentry-sigma-two.vercel.app",
        icons: [],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [celo.id]: http(rpc),
  },
  ssr: true,
  multiInjectedProviderDiscovery: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
