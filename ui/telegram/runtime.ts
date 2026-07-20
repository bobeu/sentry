import type { Context } from "telegraf";
import { groupService } from "@/services/group.service";
import { billingService } from "@/services/billing.service";
import { normalizeTelegramChatId } from "@/lib/telegram-id";
import { faqService } from "@/services/faq.service";
import { prisma } from "@/lib/prisma";

export type GroupRuntime = {
  group: NonNullable<Awaited<ReturnType<typeof groupService.findActiveGroupByTelegramId>>>;
  /** Employer who can be billed (Active + funded). */
  employerUserId: string | null;
  /** True when group is enabled for community work. */
  communityMode: boolean;
  /** True when employer can pay for billable actions. */
  billable: boolean;
  adminTelegramIds: string[];
};

export function chatIdOf(ctx: Context): string | null {
  return ctx.chat?.id != null ? normalizeTelegramChatId(String(ctx.chat.id)) : null;
}

export function isGroupChat(ctx: Context) {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

export function isPrivateChat(ctx: Context) {
  return ctx.chat?.type === "private";
}

export async function botUsername(ctx: Context) {
  const me = await ctx.telegram.getMe();
  return (me.username ?? "").toLowerCase();
}

export function mentionedBot(text: string, username: string) {
  const lower = text.toLowerCase();
  const tags = [
    username ? `@${username}` : "",
    "@sentry",
    "@tgemployee_bot",
  ].filter(Boolean);
  if (tags.some((t) => lower.includes(t))) return true;
  return /(^|\s)sentry([,:\s]|$)/i.test(text);
}

/** Also detect Telegram mention entities (incl. text_mention without @username in text). */
export function messageAddressesBot(
  message: {
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
      user?: { id: number };
    }>;
    reply_to_message?: { from?: { id?: number } };
  },
  opts: { botId: number; username: string },
) {
  const text = message.text ?? "";
  if (mentionedBot(text, opts.username)) return true;
  if (message.reply_to_message?.from?.id === opts.botId) return true;

  for (const entity of message.entities ?? []) {
    if (entity.type === "mention") {
      const slice = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
      if (
        slice === `@${opts.username}` ||
        slice === "@tgemployee_bot" ||
        slice === "@sentry"
      ) {
        return true;
      }
    }
    if (entity.type === "text_mention" && entity.user?.id === opts.botId) {
      return true;
    }
  }
  return false;
}

export function looksLikeQuestion(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("?")) return true;
  return /^(what|who|when|where|why|how|can|does|do|is|are|will|should|could|would|tell me|explain)\b/i.test(
    t,
  );
}

export function parseAdminIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String);
  } catch {
    return [];
  }
}

export function isAdminSender(adminIds: string[], fromUserId: string | null) {
  return Boolean(fromUserId && adminIds.includes(fromUserId));
}

export function capabilitiesSummary(username: string) {
  const tag = username ? `@${username}` : "@sentry";
  return [
    "I'm Sentry — your AI community employee on Telegram.",
    "",
    "I can:",
    "• Read group chats and answer with agentic reasoning (when I'm a group admin, or privacy mode is off)",
    "• Answer FAQs and community questions",
    "• Reply when mentioned or replied to",
    "• Welcome new members + moderate spam (when enabled)",
    "• Notify you of @mentions (when linked)",
    "• Employer DMs: reports, group status, past work, drafting help",
    "• Wallet/deposit commands in DM",
    "",
    `Try: ${tag} what is this group about?`,
    "Employer DM: \"group status\", \"past work\", \"full report\"",
    "Commands: /help /mywallet /balance /deposit /status",
  ].join("\n");
}

export function groupVisibilityHint(username: string) {
  const tag = username ? `@${username}` : "@sentry";
  return [
    "To let me see and help with all group chats (not only mentions), make me a group admin",
    "(or disable privacy mode for this bot in BotFather → /setprivacy → Disable).",
    `Until then I still answer when you ${tag} mention me or reply to me.`,
  ].join(" ");
}

/**
 * Resolve group runtime for agent decisions.
 * Community mode requires the group enabled; billable requires funded Active employment.
 */
export async function resolveGroupRuntime(telegramId: string): Promise<GroupRuntime | null> {
  const group = await groupService.findActiveGroupByTelegramId(telegramId);
  if (!group || group.botStatus === "removed") return null;

  const communityMode = Boolean(group.settings?.enabled);
  const adminTelegramIds = parseAdminIds(group.adminTelegramIds);

  let employerUserId: string | null = null;
  let billable = false;

  for (const link of group.employment) {
    if (!link.enabled || link.user.employment?.status !== "Active") continue;
    if (!link.user.wallet) continue;
    employerUserId = link.userId;
    try {
      const ledger = await billingService.getBalanceLedger(link.userId);
      if (ledger.availableBalance > 0) {
        billable = true;
        break;
      }
    } catch {
      // keep employer id even if ledger sync fails
    }
  }

  // Prefer any enabled employment link as employer of record for attribution
  if (!employerUserId) {
    const any = group.employment.find((l) => l.enabled);
    employerUserId = any?.userId ?? null;
  }

  return { group, employerUserId, communityMode, billable, adminTelegramIds };
}

export async function findLinkedUserByTelegram(fromUserId: string | null) {
  if (!fromUserId) return null;
  return prisma.settings.findFirst({
    where: { telegramUserId: fromUserId },
    include: {
      user: { include: { employment: true, wallet: true, settings: true } },
    },
  });
}

export function stripBotMention(text: string, username: string) {
  let cleaned = text;
  for (const tag of [username, "sentry", "tgemployee_bot"].filter(Boolean)) {
    cleaned = cleaned.replace(new RegExp(`@${tag}`, "ig"), " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

export function shouldOfferHelpOnly(text: string, username: string) {
  const cleaned = stripBotMention(text, username).toLowerCase();
  if (!cleaned) return true;
  return /^(hi|hello|hey|help|commands?|what can you do|who are you)\b/.test(cleaned);
}

export async function matchFaqForGroup(
  groupId: string,
  question: string,
): Promise<string | null> {
  const faqs = await faqService.list(groupId);
  return faqService.match(faqs, question);
}
