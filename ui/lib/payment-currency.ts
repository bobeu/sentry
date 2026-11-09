export const PAYMENT_CURRENCIES = [
  "CELO",
  "USDm",
  "USDC",
  "USDT",
  "wARS",
  "wBRL",
  "wCOP",
  "wMXN",
  "wPEN",
  "wCLP",
  "USAT",
] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const DEFAULT_PAYMENT_CURRENCY: PaymentCurrency = "USDm";

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(value);
}

/** Ripio wFIAT currencies (LatAm stablecoins on Celo Mainnet). */
export const WFIAT_CURRENCIES = ["wARS", "wBRL", "wCOP", "wMXN", "wPEN", "wCLP"] as const;
export type WFiatCurrency = (typeof WFIAT_CURRENCIES)[number];

export function isWFiatCurrency(value: string): value is WFiatCurrency {
  return (WFIAT_CURRENCIES as readonly string[]).includes(value);
}

export function formatAmount(amount: number, currency: PaymentCurrency) {
  const precision =
    currency === "CELO" ? 4 : isWFiatCurrency(currency) ? 2 : 3;
  return `${amount.toFixed(precision)} ${currency}`;
}

/** Native decimals used by supported Celo assets. */
export function tokenDecimals(currency: PaymentCurrency) {
  return currency === "USDC" || currency === "USDT" || currency === "USAT" ? 6 : 18;
}
