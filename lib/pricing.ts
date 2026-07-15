import type { ActionType } from "@prisma/client";
import type { PaymentCurrency } from "@/lib/payment-currency";
import { paymentService } from "@/services/payment.service";

/** Central pricing in active payment currency units. */
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
    amount,
    currency,
  }));
}

export function priceFor(type: ActionType): number {
  return PRICING_AMOUNTS[type] ?? 0;
}

export function averageActionCost(): number {
  const values = Object.values(PRICING_AMOUNTS);
  return values.reduce((a, b) => a + b, 0) / values.length;
}
