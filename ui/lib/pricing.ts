import type { ActionType } from "@/generated";
import type { PaymentCurrency } from "@/lib/payment-currency";
import { demoPrice } from "@/lib/demo-mode";

/** Central pricing in active payment currency units (production amounts). */
export const PRICING_AMOUNTS: Record<ActionType, number> = {
  mention_reply: 0.01,
  faq_answer: 0.005,
  welcome: 0.005,
  daily_summary: 0.05,
  spam_moderation: 0.02,
  mention_notification: 0.01,
};

export const PRICING_LABELS: Record<ActionType, string> = {
  mention_reply: "Reply to Mention",
  faq_answer: "FAQ Answer",
  welcome: "Welcome",
  daily_summary: "Daily Summary",
  spam_moderation: "Spam Moderation",
  mention_notification: "Mention Notification",
};

export function getPricing(currency: PaymentCurrency = "USDm") {
  return Object.entries(PRICING_AMOUNTS).map(([type, amount]) => ({
    type,
    label: PRICING_LABELS[type as ActionType],
    amount: demoPrice(amount),
    currency,
  }));
}

export function priceFor(type: ActionType): number {
  return demoPrice(PRICING_AMOUNTS[type] ?? 0);
}

export function averageActionCost(): number {
  const values = Object.values(PRICING_AMOUNTS).map(demoPrice);
  return values.reduce((a, b) => a + b, 0) / values.length;
}
