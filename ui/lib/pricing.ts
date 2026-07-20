import type { ActionType } from "@/generated/client";
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
  shift_handover: 0.04,
  escalation: 0.02,
  playbook_learn: 0.01,
  intent_signal: 0.01,
  incident_mode: 0.05,
  member_memory: 0.005,
  agent_task: 0.03,
  proof_report: 0.03,
  admin_moderation: 0.02,
  rose_relay: 0.01,
  announcement: 0.02,
  birthday: 0.01,
  secretary_reply: 0.015,
  secretary_escalation: 0.02,
};

export const PRICING_LABELS: Record<ActionType, string> = {
  mention_reply: "Reply to Mention",
  faq_answer: "FAQ Answer",
  welcome: "Welcome",
  daily_summary: "Daily Summary",
  spam_moderation: "Spam Moderation",
  mention_notification: "Mention Notification",
  shift_handover: "Shift Handover",
  escalation: "Escalation Review",
  playbook_learn: "Playbook Learn",
  intent_signal: "Intent Signal",
  incident_mode: "Incident Mode",
  member_memory: "Member Memory",
  agent_task: "Agent Task API",
  proof_report: "Proof of Work",
  admin_moderation: "Admin Moderation",
  rose_relay: "Rose Command Relay",
  announcement: "Announcement",
  birthday: "Birthday Celebration",
  secretary_reply: "Secretary Reply",
  secretary_escalation: "Secretary Escalation",
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
