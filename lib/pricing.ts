import type { ActionType } from "@prisma/client";

/** Central pricing in cUSD (display units). Easy to change later. */
export const PRICING_CUSD: Record<ActionType, number> = {
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

export function getPricing() {
  return Object.entries(PRICING_CUSD).map(([type, amount]) => ({
    type,
    label: PRICING_LABELS[type as ActionType],
    amount,
    currency: "cUSD",
  }));
}

export function priceFor(type: ActionType): number {
  return PRICING_CUSD[type] ?? 0;
}

export function averageActionCost(): number {
  const values = Object.values(PRICING_CUSD);
  return values.reduce((a, b) => a + b, 0) / values.length;
}
