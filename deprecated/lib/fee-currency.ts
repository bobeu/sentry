import { isAddress, type Address } from "viem";

/**
 * CIP-64 fee currency for gas (independent of wallet payment currency).
 * Default is CELO (omit feeCurrency) so existing txs and operator balances keep working.
 *
 * FEE_CURRENCY=stable → pay gas in a stable (USDm / USDC / USDT)
 * FEE_CURRENCY_STABLE=USDm|USDC|USDT → which stable (default USDm)
 * FEE_CURRENCY_ADDRESS → optional override of the feeCurrency address (adapter for USDC/USDT)
 */

export type FeeCurrencyMode = "celo" | "stable";
export type StableFeeToken = "USDm" | "USDC" | "USDT";

/** Celo mainnet: 18-decimal stables use the token; 6-decimal use FeeCurrencyAdapter. */
const MAINNET_FEE_CURRENCY: Record<StableFeeToken, Address> = {
  // USDm (Mento Dollar / cUSD) — 18 decimals, token address is the fee currency
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  // USDC / USDT — use adapters (not the ERC-20 token addresses)
  USDC: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
  USDT: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
};

function envMode(): FeeCurrencyMode {
  const raw = (process.env.FEE_CURRENCY ?? "celo").trim().toLowerCase();
  return raw === "stable" ? "stable" : "celo";
}

function envStableToken(): StableFeeToken {
  const raw = (process.env.FEE_CURRENCY_STABLE ?? "USDm").trim();
  if (raw === "USDC" || raw === "USDT" || raw === "USDm") return raw;
  return "USDm";
}

/** Resolved feeCurrency address, or undefined when gas is paid in CELO. */
export function getTxFeeCurrency(): Address | undefined {
  if (envMode() !== "stable") return undefined;

  const override = process.env.FEE_CURRENCY_ADDRESS?.trim();
  if (override && isAddress(override)) return override as Address;

  const token = envStableToken();
  // Prefer configured ERC-20 for USDm when set (factory was deployed with this); adapters stay fixed.
  if (token === "USDm") {
    const usdm = process.env.CELO_USDM_ADDRESS?.trim();
    if (usdm && isAddress(usdm)) return usdm as Address;
  }

  return MAINNET_FEE_CURRENCY[token];
}

export function getFeeCurrencyMode(): FeeCurrencyMode {
  return envMode();
}

export function getStableFeeToken(): StableFeeToken | null {
  return envMode() === "stable" ? envStableToken() : null;
}

/** Spread into viem sendTransaction / writeContract. Empty when paying gas in CELO. */
export function txFeeOpts(): { feeCurrency?: Address } {
  const feeCurrency = getTxFeeCurrency();
  return feeCurrency ? { feeCurrency } : {};
}
