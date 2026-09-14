import { groupService } from "@/services/group.service";
import { billingService } from "@/services/billing.service";
import { faqService } from "@/services/faq.service";
import {
  isCasualGreeting,
  isGratitudeOnly,
  isHelpRequest,
} from "@/lib/telegram-message";

export type GroupReplyEvaluation = {
  chatType: "private" | "group" | "unknown";
  groupLinked: boolean;
  communityMode: boolean;
  billable: boolean;
  addressed: boolean;
  fromAdmin: boolean;
  /** True when Sentry should send *some* reply (may be short ack). */
  shouldReply: boolean;
  /** True when the message warrants a full agent/tool answer (not just ack). */
  shouldAgentReply: boolean;
  proactive: boolean;
  reason:
    | "private_dm"
    | "addressed_mention"
    | "addressed_reply"
    | "proactive_question"
    | "proactive_faq_match"
    | "proactive_context"
    | "gratitude_ack"
    | "greeting"
    | "help_capabilities"
    | "settings_off"
    | "not_linked"
    | "casual_banter"
    | "listen_only";
  matchedFaq: boolean;
  settings: {
    answerQuestions: boolean;
    replyToMentions: boolean;
    enabled: boolean;
  } | null;
  hint: string | null;
};

function parseAdminIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String);
  } catch {
    return [];
  }
}

function looksLikeQuestion(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("?")) return true;
  return /^(what|who|when|where|why|how|can|does|do|is|are|will|should|could|would|tell me|explain)\b/i.test(
    t,
  );
}

function stripBotMention(text: string, botUsername?: string) {
  let cleaned = text;
  for (const tag of [botUsername, "sentry", "tgemployee_bot", "tgemployeebot"].filter(Boolean)) {
    cleaned = cleaned.replace(new RegExp(`@${tag}`, "ig"), " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

function shouldOfferHelpOnly(text: string, botUsername?: string) {
  const cleaned = stripBotMention(text, botUsername);
  if (!cleaned.trim()) return true;
  if (isCasualGreeting(cleaned)) return false;
  return isHelpRequest(cleaned);
}

async function resolveBillable(group: NonNullable<
  Awaited<ReturnType<typeof groupService.findActiveGroupByTelegramId>>
>) {
  for (const link of group.employment) {
    if (!link.enabled || link.user.employment?.status !== "Active") continue;
    if (!link.user.wallet) continue;
    try {
      const ledger = await billingService.getBalanceLedger(link.userId);
      if (ledger.availableBalance > 0) return true;
    } catch {
      // ignore ledger errors
    }
  }
  return false;
}

export class GroupReplyService {
  /**
   * Decide whether Sentry should reply in a group (or DM) — mirrors legacy Telegraf
   * handleGroupIntelligence gating so OpenClaw can stay silent when appropriate.
   */
  async evaluate(input: {
    chatId?: string;
    chatType?: "private" | "group" | "supergroup" | "channel";
    messageText?: string;
    telegramUserId?: string;
    addressed?: boolean;
    botUsername?: string;
  }): Promise<GroupReplyEvaluation> {
    const text = (input.messageText ?? "").trim();
    const chatType =
      input.chatType === "private"
        ? "private"
        : input.chatType === "group" || input.chatType === "supergroup"
          ? "group"
          : "unknown";
    const addressed = Boolean(input.addressed);
    const botUsername = input.botUsername?.replace(/^@/, "").toLowerCase();

    if (chatType === "private") {
      return {
        chatType: "private",
        groupLinked: true,
        communityMode: true,
        billable: true,
        addressed: true,
        fromAdmin: false,
        shouldReply: text.length > 0,
        shouldAgentReply: text.length > 0 && !text.startsWith("/"),
        proactive: false,
        reason: "private_dm",
        matchedFaq: false,
        settings: null,
        hint: "DM: always respond unless empty; slash commands may be handled by bridge.",
      };
    }

    if (!input.chatId) {
      return {
        chatType: "unknown",
        groupLinked: false,
        communityMode: false,
        billable: false,
        addressed,
        fromAdmin: false,
        shouldReply: addressed,
        shouldAgentReply: addressed,
        proactive: false,
        reason: addressed ? "addressed_mention" : "listen_only",
        matchedFaq: false,
        settings: null,
        hint: null,
      };
    }

    const group = await groupService.findActiveGroupByTelegramId(input.chatId);
    if (!group) {
      return {
        chatType: "group",
        groupLinked: false,
        communityMode: false,
        billable: false,
        addressed,
        fromAdmin: false,
        shouldReply: addressed,
        shouldAgentReply: addressed,
        proactive: false,
        reason: addressed ? "addressed_mention" : "listen_only",
        matchedFaq: false,
        settings: null,
        hint: addressed
          ? "Group not linked — acknowledge and point to dashboard."
          : "Not linked — stay silent unless addressed.",
      };
    }

    const settings = group.settings;
    const communityMode = Boolean(settings?.enabled);
    const adminIds = parseAdminIds(group.adminTelegramIds);
    const fromAdmin = Boolean(
      input.telegramUserId && adminIds.includes(input.telegramUserId),
    );
    const billable = await resolveBillable(group);
    const cleaned = stripBotMention(text, botUsername) || text;
    const config = {
      answerQuestions: settings?.answerQuestions ?? true,
      replyToMentions: settings?.replyToMentions ?? true,
      enabled: communityMode,
    };

    const faqs = await faqService.list(group.id);
    const faqMatch = text ? faqService.match(faqs, cleaned) : null;

    if (isGratitudeOnly(cleaned)) {
      const ack = addressed || communityMode;
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: ack,
        shouldAgentReply: false,
        proactive: false,
        reason: "gratitude_ack",
        matchedFaq: false,
        settings: config,
        hint: ack ? "Short thanks ack only — do not re-answer prior questions." : null,
      };
    }

    if (addressed && isCasualGreeting(cleaned)) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: true,
        shouldAgentReply: false,
        proactive: false,
        reason: "greeting",
        matchedFaq: false,
        settings: config,
        hint: "Friendly greeting only — no FAQ dump.",
      };
    }

    if (addressed && shouldOfferHelpOnly(text, botUsername)) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: true,
        shouldAgentReply: false,
        proactive: false,
        reason: "help_capabilities",
        matchedFaq: false,
        settings: config,
        hint: "Capabilities summary — not a full agent run unless they ask a specific question.",
      };
    }

    if (addressed) {
      if (!communityMode && !fromAdmin) {
        return {
          chatType: "group",
          groupLinked: true,
          communityMode,
          billable,
          addressed,
          fromAdmin,
          shouldReply: true,
          shouldAgentReply: false,
          proactive: false,
          reason: "not_linked",
          matchedFaq: false,
          settings: config,
          hint: "Community mode off — explain activation.",
        };
      }

      if (!settings?.replyToMentions && !settings?.answerQuestions) {
        return {
          chatType: "group",
          groupLinked: true,
          communityMode,
          billable,
          addressed,
          fromAdmin,
          shouldReply: true,
          shouldAgentReply: false,
          proactive: false,
          reason: "settings_off",
          matchedFaq: false,
          settings: config,
          hint: "Mention settings off — tell employer to enable in dashboard.",
        };
      }

      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: true,
        shouldAgentReply: true,
        proactive: false,
        reason: addressed ? "addressed_mention" : "addressed_reply",
        matchedFaq: Boolean(faqMatch),
        settings: config,
        hint: "Full agent reply — use get_context + answer_faq/generate_reply.",
      };
    }

    // Proactive (no mention): community Q&A when enabled.
    if (!communityMode || !settings?.answerQuestions) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: false,
        shouldAgentReply: false,
        proactive: false,
        reason: "listen_only",
        matchedFaq: false,
        settings: config,
        hint: "Log context only — answerQuestions off or community mode off.",
      };
    }

    if (!faqMatch && !looksLikeQuestion(cleaned)) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: false,
        shouldAgentReply: false,
        proactive: false,
        reason: "casual_banter",
        matchedFaq: false,
        settings: config,
        hint: "Member banter — stay silent unless context clearly needs Sentry (FAQ, incident, spam).",
      };
    }

    if (!billable && !faqMatch) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: false,
        shouldAgentReply: false,
        proactive: false,
        reason: "listen_only",
        matchedFaq: false,
        settings: config,
        hint: "Unfunded — stay silent on proactive Q unless FAQ matched.",
      };
    }

    if (faqMatch && !billable) {
      return {
        chatType: "group",
        groupLinked: true,
        communityMode,
        billable,
        addressed,
        fromAdmin,
        shouldReply: true,
        shouldAgentReply: true,
        proactive: true,
        reason: "proactive_faq_match",
        matchedFaq: true,
        settings: config,
        hint: "FAQ hit — answer even when unfunded.",
      };
    }

    return {
      chatType: "group",
      groupLinked: true,
      communityMode,
      billable,
      addressed,
      fromAdmin,
      shouldReply: true,
      shouldAgentReply: true,
      proactive: true,
      reason: faqMatch ? "proactive_faq_match" : "proactive_question",
      matchedFaq: Boolean(faqMatch),
      settings: config,
      hint: "Proactive Q&A — use tools; do not reply to unrelated banter.",
    };
  }
}

export const groupReplyService = new GroupReplyService();
