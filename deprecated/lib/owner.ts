import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { requireSessionUser } from "@/lib/auth";

/** Grand admin / Sentry owner Telegram user id (AskBot, analytics, privileged ops). */
export const GRAND_ADMIN_TELEGRAM_ID = "805099765";

export function isGrandAdminTelegramId(
  telegramUserId: string | null | undefined,
): boolean {
  return Boolean(telegramUserId && telegramUserId === GRAND_ADMIN_TELEGRAM_ID);
}

/** True when the signed-in dashboard user linked the grand-admin Telegram id. */
export async function isGrandAdminUser(userId: string): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { userId },
    select: { telegramUserId: true },
  });
  return isGrandAdminTelegramId(settings?.telegramUserId);
}

export async function requireGrandAdmin() {
  const user = await requireSessionUser();
  if (!(await isGrandAdminUser(user.id))) {
    throw Errors.forbidden();
  }
  return user;
}
