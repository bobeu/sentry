export class SentryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "SentryError";
    this.code = code;
    this.status = status;
  }
}

export const Errors = {
  unauthorized: () => new SentryError("UNAUTHORIZED", "Unauthorized", 401),
  forbidden: () => new SentryError("FORBIDDEN", "Forbidden", 403),
  employmentInactive: () =>
    new SentryError("EMPLOYMENT_INACTIVE", "Employment is not active. Hire Sentry and fund your wallet."),
  walletNotFunded: () =>
    new SentryError("WALLET_NOT_FUNDED", "Wallet not funded. Deposit funds to activate Sentry."),
  botNotEnabled: () =>
    new SentryError("BOT_NOT_ENABLED", "Sentry is not enabled for this group."),
  aiUnavailable: () =>
    new SentryError("AI_UNAVAILABLE", "AI service is temporarily unavailable."),
  blockchainUnavailable: () =>
    new SentryError("BLOCKCHAIN_UNAVAILABLE", "Blockchain service is unavailable. Charge pending."),
  telegramUnavailable: () =>
    new SentryError("TELEGRAM_UNAVAILABLE", "Telegram API is unavailable."),
  chargeFailed: (reason?: string) =>
    new SentryError(
      "CHARGE_FAILED",
      reason ?? "Smart contract charge failed. Work recorded but not billed.",
      402,
    ),
  groupNotFound: () => new SentryError("GROUP_NOT_FOUND", "Group not found for this account."),
  invalidCurrency: () => new SentryError("INVALID_CURRENCY", "Invalid payment currency."),
  badRequest: (message = "Bad request") =>
    new SentryError("BAD_REQUEST", message, 400),
};

export function errorResponse(error: unknown) {
  if (error instanceof SentryError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return { message: error.message, code: "UNAUTHORIZED", status: 401 };
    }
    return { message: error.message, code: "ERROR", status: 400 };
  }
  return { message: "Request failed", code: "ERROR", status: 500 };
}
