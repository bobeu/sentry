export const PAYMENT_CURRENCIES = [
  "CELO",
  "USDm",
  "USDC",
  "USDT",
  "wARS",
  "wBRL",
  "USAT",
] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const DEFAULT_PAYMENT_CURRENCY: PaymentCurrency = "USDm";

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(value);
}

export function formatAmount(amount: number, currency: PaymentCurrency) {
  const precision = currency === "CELO" ? 4 : currency === "wARS" || currency === "wBRL" ? 2 : 3;
  return `${amount.toFixed(precision)} ${currency}`;
}

/** Native decimals used by supported Celo assets. */
export function tokenDecimals(currency: PaymentCurrency) {
  return currency === "USDC" || currency === "USDT" || currency === "USAT" ? 6 : 18;
}
