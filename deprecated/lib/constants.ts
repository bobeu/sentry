export const APP_NAME = "Sentry";

export const TASK_TYPES = {
  ANSWERED_MENTION: "answered_mention",
  MODERATED_SPAM: "moderated_spam",
  GENERATED_SUMMARY: "generated_summary",
  WELCOMED_USER: "welcomed_user",
  FAQ_ANSWER: "faq_answer",
  REPORT: "report",
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];
