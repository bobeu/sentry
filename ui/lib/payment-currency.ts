export const PAYMENT_CURRENCIES = ["CELO", "USDm", "USDC", "USDT"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const DEFAULT_PAYMENT_CURRENCY: PaymentCurrency = "USDm";

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(value);
}

export function formatAmount(amount: number, currency: PaymentCurrency) {
  return `${amount.toFixed(currency === "CELO" ? 4 : 3)} ${currency}`;
}

/** Native decimals used by supported Celo assets. */
export function tokenDecimals(currency: PaymentCurrency) {
  return currency === "USDC" || currency === "USDT" ? 6 : 18;
}
