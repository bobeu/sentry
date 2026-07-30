export const SUPPORTED_NETWORKS = ["CELO", "GOAT"] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export const DEFAULT_NETWORK: SupportedNetwork = "CELO";

export function isSupportedNetwork(value: string): value is SupportedNetwork {
  return SUPPORTED_NETWORKS.includes(value as SupportedNetwork);
}
