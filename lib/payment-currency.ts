export const PAYMENT_CURRENCIES = ["CELO", "USDm", "USDC", "USDT"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const DEFAULT_PAYMENT_CURRENCY: PaymentCurrency = "USDm";

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(value);
}

export function formatAmount(amount: number, currency: PaymentCurrency) {
  return `${amount.toFixed(currency === "CELO" ? 4 : 3)} ${currency}`;
}

/** Token decimals for display/charging (MVP — all 18 except we treat stablecoins as 18 on Celo). */
export function tokenDecimals(currency: PaymentCurrency) {
  return currency === "CELO" ? 18 : 18;
}
