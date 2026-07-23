import type { Context } from "telegraf";
import { prisma } from "@/lib/prisma";
import { rewardService } from "@/services/reward.service";
import { aiService } from "@/services/ai.service";
import type { ContextBundle } from "@/services/context.service";

export type ActivityType = "poll" | "game" | "learn" | "social" | "comic" | "fun";

type SocialConfig = {
  platform?: string;
  action?: "like" | "retweet" | "repost" | "follow" | "comment";
  targetUrl: string;
  verifyHint?: string;
};

type QuizConfig = {
  question: string;
  options?: string[];
  /** 0-based correct option index (quiz / single-answer) */
  correctIndex?: number;
  explanation?: string;
  /** single | multiple | quiz | open */
  format?: "single" | "multiple" | "quiz" | "open";
  /** accepted answers for open text (lowercase match) */
  acceptedAnswers?: string[];
};

function parseConfig<T>(raw: string | null | undefined): T {
  try {
    return JSON.parse(raw || "{}") as T;
  } catch {
    return {} as T;
  }
}

/** Questions about polls/activities — must NOT create a new activity. */
export function isEngagementQuery(text: string) {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (
    /\b(when|what time|how long|until|ends?|ending|deadline|closes?|closing|expire|expiry)\b/.test(
      t,
    ) &&
    /\b(poll|trivia|quiz|activity|activities|game|campaign)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(what|which|any|available|open|active|ongoing|current)\b/.test(t) &&
    /\b(poll|trivia|quiz|activit|game|campaign|task|challenge|earn|points)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(status|info|details|rules|conditions|rewards?)\b/.test(t) &&
    /\b(poll|trivia|quiz|activity|game)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Explicit ask for the activity menu / what can I play. */
export function isActivityMenuRequest(text: string) {
  const t = text.toLowerCase().trim();
  return (
    /\bwhat\s+(activities|games|tasks|polls|quizzes)\b/.test(t) ||
    /\b(activities|games|tasks)\s+available\b/.test(t) ||
    /\bwhat\s+can\s+(i|we)\s+(play|do|earn|join)\b/.test(t) ||
    /\bwhat'?s\s+(on|available|enabled)\b/.test(t) ||
    /\bshow\s+(me\s+)?(activities|games|tasks|polls)\b/.test(t) ||
    /\bplay\s+something\b/.test(t) ||
    /\bi\s+want\s+to\s+(play|earn|join)\b/.test(t) ||
    /\b(available|enabled)\s+(activit|task|game|poll|quiz)/.test(t)
  );
}

/**
 * True only when the user clearly wants to CREATE / START an activity.
 * Mentions of "poll" alone (e.g. "when does the poll end?") do not match.
 */
export function wantsCreateActivity(text: string) {
  if (isEngagementQuery(text) || isActivityMenuRequest(text)) return false;
  const t = text.trim();
  // Slash / bare start commands only when the message is essentially the command.
  if (
    /^(?:\/)?(?:start[_-]?)?(?:poll|trivia|quiz|game|fun|learn|comic|social|campaign)(?:\s|$)/i.test(
      t,
    )
  ) {
    return true;
  }
  // Natural language create/start verbs + activity noun.
  return /\b(start|launch|begin|create|run|host|drop|spin\s+up|kick\s*off|let'?s\s+(do|run|play|make))\b[\s\S]{0,40}\b(poll|trivia|quiz|quizzes|game|fun|learn(?:\s*and\s*earn)?|comic|social|campaign|activity)\b/i.test(
    t,
  );
}

/** @deprecated use wantsCreateActivity — kept for call-site compatibility */
export function isEngagementStartCommand(text: string) {
  return wantsCreateActivity(text);
}

export function detectEngagementIntent(text: string): ActivityType | null {
  const t = text.toLowerCase();
  // Prefer specific quiz/trivia before generic "poll"/"vote".
  if (/\b(trivia|quiz|quizzes|learn\s*and\s*earn)\b/.test(t)) return "learn";
  if (/\b(comic|meme|joke|jokes|comedy|hilarious)\b/.test(t)) return "comic";
  if (
    /\b(twitter|x\.com|retweet|repost|like\s+(the\s+)?(post|tweet)|social\s+campaign)\b/.test(
      t,
    )
  ) {
    return "social";
  }
  if (/\b(game|play\s+a\s+game|mini[- ]?game)\b/.test(t)) return "game";
  if (/\b(poll|vote|voting)\b/.test(t)) return "poll";
  if (/\b(fun|vibe\s*check)\b/.test(t)) return "fun";
  return null;
}

function formatClosesAt(d: Date | null | undefined) {
  if (!d) return "open-ended (employer can close anytime)";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function parseDurationMs(hint?: string | null): number {
  if (!hint) return 24 * 60 * 60 * 1000;
  const m = hint.match(
    /\b(?:for\s+)?(\d+)\s*(minute|min|hour|hr|h|day|d)s?\b/i,
  );
  if (!m) return 24 * 60 * 60 * 1000;
  const n = Math.max(1, Number(m[1]) || 1);
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith("min")) return Math.min(n, 7 * 24 * 60) * 60 * 1000;
  if (unit.startsWith("h")) return Math.min(n, 168) * 60 * 60 * 1000;
  return Math.min(n, 14) * 24 * 60 * 60 * 1000;
}

const TWITTER_STATUS_RE =
  /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/\s]+\/status\/(\d+)/i;
const TWITTER_PROFILE_RE =
  /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})\/?(?:\?|$)/i;

export class EngagementService {
  async activeActivities(groupId: string) {
    return prisma.engagementActivity.findMany({
      where: { groupId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async closeActivity(activityId: string) {
    return prisma.engagementActivity.update({
      where: { id: activityId },
      data: { status: "closed" },
    });
  }

  typeAllowed(
    type: ActivityType,
    settings: {
      allowGames?: boolean | null;
      allowPolls?: boolean | null;
      allowFun?: boolean | null;
      allowComics?: boolean | null;
      allowSocialCampaigns?: boolean | null;
    } | null,
  ) {
    if (!settings) return false;
    switch (type) {
      case "poll":
        return Boolean(settings.allowPolls);
      case "game":
      case "learn":
        return Boolean(settings.allowGames || settings.allowFun);
      case "comic":
        return Boolean(settings.allowComics || settings.allowFun);
      case "social":
        return Boolean(settings.allowSocialCampaigns);
      case "fun":
        return Boolean(settings.allowFun);
      default:
        return false;
    }
  }

  defaultPoints(
    type: ActivityType,
    settings: {
      pointsPerCorrect?: number | null;
      pointsPerPoll?: number | null;
      pointsPerGame?: number | null;
      pointsPerSocial?: number | null;
    } | null,
  ) {
    switch (type) {
      case "poll":
        return settings?.pointsPerPoll ?? 5;
      case "social":
        return settings?.pointsPerSocial ?? 20;
      case "learn":
        return settings?.pointsPerCorrect ?? 10;
      case "game":
      case "fun":
      case "comic":
      default:
        return settings?.pointsPerGame ?? 15;
    }
  }

  /**
   * Generate a lively poll / trivia / fun prompt via LLM, then persist activity.
   */
  async inventActivity(input: {
    groupId: string;
    type: ActivityType;
    context: ContextBundle;
    guidelines?: string | null;
    createdByUserId?: string | null;
    hint?: string | null;
  }) {
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!this.typeAllowed(input.type, settings)) {
      throw new Error(
        `${input.type} activities are disabled for this group. Enable them in dashboard capabilities.`,
      );
    }

    const draft = await aiService.generateEngagementActivity({
      type: input.type,
      context: input.context,
      guidelines: input.guidelines ?? settings?.engagementGuidelines,
      hint: input.hint,
    });

    const points = this.defaultPoints(input.type, settings);
    const closesAt = new Date(Date.now() + parseDurationMs(input.hint));
    return prisma.engagementActivity.create({
      data: {
        groupId: input.groupId,
        type: input.type,
        status: "active",
        title: draft.title,
        description: draft.description,
        configJson: JSON.stringify(draft.config),
        pointsReward: points,
        createdByUserId: input.createdByUserId ?? null,
        closesAt,
      },
    });
  }

  /** Human-readable brief for the group after launching (or when asked about status). */
  formatActivityBrief(
    activity: {
      title: string;
      description: string | null;
      type: string;
      pointsReward: number;
      closesAt: Date | null;
      configJson: string;
    },
    settings: {
      rewardEnabled?: boolean | null;
      rewardPaused?: boolean | null;
      rewardAmountPerPoint?: { toString(): string } | number | null;
      rewardCurrency?: string | null;
    } | null,
  ) {
    const config = parseConfig<QuizConfig>(activity.configJson);
    const format = config.format ?? (activity.type === "poll" ? "single" : "quiz");
    const perPoint = Number(settings?.rewardAmountPerPoint?.toString?.() ?? settings?.rewardAmountPerPoint ?? 0);
    const currency = settings?.rewardCurrency ?? "USDm";
    const cashOn =
      Boolean(settings?.rewardEnabled) && !settings?.rewardPaused && perPoint > 0;
    const cashLine = cashOn
      ? `Cash: ~${(activity.pointsReward * perPoint).toFixed(4)} ${currency} (at ${perPoint} ${currency}/pt) — withdraw by tagging me with your 0x wallet`
      : "Cash: points only right now (employer can enable cash rewards later)";

    const lines = [
      `🎯 **${activity.title}**`,
      activity.description?.trim() || null,
      `Type: ${activity.type} · format: ${format}`,
      `Ends: ${formatClosesAt(activity.closesAt)}`,
      `Points to earn: **${activity.pointsReward}** (one verified entry)`,
      cashLine,
      "Withdrawal: tag me with your 0x address when you have pending cash.",
      format === "open"
        ? "How to play: reply tagging me with your answer (no options)."
        : format === "multiple"
          ? "How to play: pick one or more options on the poll."
          : activity.type === "poll"
            ? "How to play: tap an option on the poll — any vote counts."
            : "How to play: tap the correct option on the quiz poll.",
      "Conditions: one entry per member · be kind · no spoilers in chat until it closes.",
    ];
    return lines.filter(Boolean).join("\n");
  }

  enabledActivityTypes(settings: {
    allowGames?: boolean | null;
    allowPolls?: boolean | null;
    allowFun?: boolean | null;
    allowComics?: boolean | null;
    allowSocialCampaigns?: boolean | null;
  } | null): Array<{ type: ActivityType; label: string; blurb: string }> {
    const out: Array<{ type: ActivityType; label: string; blurb: string }> = [];
    if (!settings) return out;
    if (settings.allowPolls) {
      out.push({ type: "poll", label: "Polls", blurb: "Quick group votes" });
    }
    if (settings.allowGames || settings.allowFun) {
      out.push({
        type: "learn",
        label: "Quizzes",
        blurb: "Trivia / learn-and-earn",
      });
      out.push({ type: "game", label: "Games", blurb: "Playful quiz rounds" });
    }
    if (settings.allowFun) {
      out.push({ type: "fun", label: "Fun", blurb: "Vibe checks & laughs" });
    }
    if (settings.allowComics || settings.allowFun) {
      out.push({ type: "comic", label: "Jokes", blurb: "Comedy / meme beats" });
    }
    if (settings.allowSocialCampaigns) {
      out.push({
        type: "social",
        label: "Social",
        blurb: "Twitter/X challenges",
      });
    }
    return out;
  }

  activityMenuKeyboard(enabled: Array<{ type: ActivityType; label: string }>) {
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < enabled.length; i += 2) {
      const row = enabled.slice(i, i + 2).map((e) => ({
        text: e.label,
        callback_data: `act:${e.type}`,
      }));
      rows.push(row);
    }
    return { inline_keyboard: rows };
  }

  async summarizeActiveForGroup(groupId: string) {
    const active = await this.activeActivities(groupId);
    if (!active.length) return "No active activities right now.";
    return active
      .map(
        (a, i) =>
          `${i + 1}. **${a.title}** (${a.type}) — ends ${formatClosesAt(a.closesAt)} — ${a.pointsReward} pts`,
      )
      .join("\n");
  }

  async closeActiveOfTypes(groupId: string, types?: ActivityType[]) {
    const where = {
      groupId,
      status: "active" as const,
      ...(types?.length ? { type: { in: types } } : {}),
    };
    const open = await prisma.engagementActivity.findMany({ where });
    if (!open.length) return { closed: 0, titles: [] as string[] };
    await prisma.engagementActivity.updateMany({
      where: { id: { in: open.map((a) => a.id) } },
      data: { status: "closed" },
    });
    return { closed: open.length, titles: open.map((a) => a.title) };
  }

  /** Create a social campaign from an employer-provided URL. */
  async createSocialCampaign(input: {
    groupId: string;
    targetUrl: string;
    action?: SocialConfig["action"];
    title?: string;
    createdByUserId?: string | null;
  }) {
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!this.typeAllowed("social", settings)) {
      throw new Error("Social campaigns are disabled for this group.");
    }
    const action = input.action ?? "retweet";
    const config: SocialConfig = {
      platform: "twitter",
      action,
      targetUrl: input.targetUrl.trim(),
      verifyHint: `Submit your ${action} link or profile URL tagging Sentry.`,
    };
    return prisma.engagementActivity.create({
      data: {
        groupId: input.groupId,
        type: "social",
        status: "active",
        title: input.title ?? `Social: ${action} this post`,
        description: `Interact (${action}) then reply tagging Sentry with your proof link.`,
        configJson: JSON.stringify(config),
        pointsReward: this.defaultPoints("social", settings),
        createdByUserId: input.createdByUserId ?? null,
        closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Post a Telegram native poll (or skip for open-text formats).
   * Accepts Context or a telegram API + chatId (employer DM → group).
   */
  async postTelegramPoll(
    target: Context | { telegram: Context["telegram"]; chatId: string | number },
    activity: {
      id: string;
      title: string;
      description: string | null;
      configJson: string;
      type: string;
      pointsReward?: number;
      closesAt?: Date | null;
    },
    settings?: {
      rewardEnabled?: boolean | null;
      rewardPaused?: boolean | null;
      rewardAmountPerPoint?: { toString(): string } | number | null;
      rewardCurrency?: string | null;
    } | null,
  ) {
    const telegram =
      "telegram" in target && "chatId" in target
        ? target.telegram
        : (target as Context).telegram;
    const chatId =
      "chatId" in target
        ? target.chatId
        : (target as Context).chat!.id;

    const config = parseConfig<QuizConfig>(activity.configJson);
    const format =
      config.format ??
      (activity.type === "learn" || activity.type === "game" ? "quiz" : "single");

    const brief = this.formatActivityBrief(
      {
        title: activity.title,
        description: activity.description,
        type: activity.type,
        pointsReward: activity.pointsReward ?? 0,
        closesAt: activity.closesAt ?? null,
        configJson: activity.configJson,
      },
      settings ?? null,
    );

    // Open-text: no native poll — announce only; answers via tagged replies.
    if (format === "open") {
      const msg = await telegram.sendMessage(chatId, brief);
      await prisma.engagementActivity.update({
        where: { id: activity.id },
        data: { telegramMsgId: String(msg.message_id) },
      });
      return msg;
    }

    const options = (
      config.options?.filter((o) => o.trim()) ?? ["Yes", "No", "Maybe"]
    ).slice(0, 10);
    if (options.length < 2) {
      throw new Error("Poll needs at least 2 options");
    }

    const question = (config.question || activity.title).slice(0, 300);
    const isAnonymous = activity.type === "poll";
    const isQuiz =
      format === "quiz" || activity.type === "learn" || activity.type === "game";
    const extra: Record<string, unknown> = {
      is_anonymous: isAnonymous,
      allows_multiple_answers: format === "multiple" && !isQuiz,
    };
    if (isQuiz && format !== "multiple") {
      extra.type = "quiz";
      if (typeof config.correctIndex === "number") {
        extra.correct_option_id = config.correctIndex;
      }
      if (config.explanation) {
        extra.explanation = config.explanation.slice(0, 200);
      }
    }

    await telegram.sendMessage(chatId, brief).catch(() => undefined);

    const msg = await telegram.sendPoll(
      chatId,
      question,
      options,
      extra as Parameters<Context["telegram"]["sendPoll"]>[3],
    );

    await prisma.engagementActivity.update({
      where: { id: activity.id },
      data: {
        telegramPollId: "poll" in msg && msg.poll ? msg.poll.id : null,
        telegramMsgId: String(msg.message_id),
      },
    });

    return msg;
  }

  /** Score open-text answers for active open-format learn/fun/comic activities. */
  async handleOpenTextAnswer(input: {
    groupId: string;
    telegramUserId: string;
    username?: string | null;
    text: string;
  }) {
    const open = await prisma.engagementActivity.findMany({
      where: {
        groupId: input.groupId,
        status: "active",
        type: { in: ["learn", "fun", "comic", "game"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const activity = open.find((a) => {
      const c = parseConfig<QuizConfig>(a.configJson);
      return c.format === "open" || (!c.options?.length && c.acceptedAnswers?.length);
    });
    if (!activity) return null;

    const config = parseConfig<QuizConfig>(activity.configJson);
    const accepted = (config.acceptedAnswers ?? []).map((a) => a.toLowerCase().trim());
    if (!accepted.length) return null;

    const existing = await prisma.activitySubmission.findUnique({
      where: {
        activityId_telegramUserId: {
          activityId: activity.id,
          telegramUserId: input.telegramUserId,
        },
      },
    });
    if (existing) {
      return { activity, duplicate: true as const, points: 0, verified: existing.verified };
    }

    const answer = input.text.toLowerCase().replace(/@\w+/g, "").trim();
    const verified = accepted.some(
      (a) => answer === a || answer.includes(a) || a.includes(answer),
    );
    const points = verified ? activity.pointsReward : 0;
    await prisma.activitySubmission.create({
      data: {
        activityId: activity.id,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        payload: input.text.slice(0, 500),
        verified,
        pointsAwarded: points,
        notes: verified ? "open-correct" : "open-incorrect",
      },
    });
    if (points > 0) {
      await rewardService.awardPoints({
        groupId: activity.groupId,
        telegramUserId: input.telegramUserId,
        username: input.username,
        points,
        reason: `${activity.type}:${activity.title}`,
        activityId: activity.id,
      });
    }
    return { activity, duplicate: false as const, points, verified };
  }

  async handlePollAnswer(input: {
    pollId: string;
    telegramUserId: string;
    username?: string | null;
    optionIds: number[];
  }) {
    const activity = await prisma.engagementActivity.findFirst({
      where: { telegramPollId: input.pollId, status: "active" },
    });
    if (!activity) return null;

    const existing = await prisma.activitySubmission.findUnique({
      where: {
        activityId_telegramUserId: {
          activityId: activity.id,
          telegramUserId: input.telegramUserId,
        },
      },
    });
    if (existing) return { activity, duplicate: true as const, points: 0 };

    const config = parseConfig<QuizConfig>(activity.configJson);
    let verified = activity.type === "poll";
    let notes = `options=${input.optionIds.join(",")}`;
    if (activity.type === "learn" || activity.type === "game") {
      verified =
        typeof config.correctIndex === "number" &&
        input.optionIds.includes(config.correctIndex);
      notes = verified ? "correct" : "incorrect";
    }

    const points = verified ? activity.pointsReward : 0;
    await prisma.activitySubmission.create({
      data: {
        activityId: activity.id,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        payload: JSON.stringify({ optionIds: input.optionIds }),
        verified,
        pointsAwarded: points,
        notes,
      },
    });

    if (points > 0) {
      await rewardService.awardPoints({
        groupId: activity.groupId,
        telegramUserId: input.telegramUserId,
        username: input.username,
        points,
        reason: `${activity.type}:${activity.title}`,
        activityId: activity.id,
      });
    }

    return { activity, duplicate: false as const, points, verified };
  }

  /**
   * Heuristic social verification: user must submit a status/profile URL.
   * Full Twitter API verification is optional via TWITTER_BEARER_TOKEN.
   */
  async verifySocialSubmission(input: {
    activityId: string;
    telegramUserId: string;
    username?: string | null;
    text: string;
  }) {
    const activity = await prisma.engagementActivity.findUnique({
      where: { id: input.activityId },
    });
    if (!activity || activity.status !== "active" || activity.type !== "social") {
      return { ok: false as const, message: "No active social campaign found." };
    }

    const existing = await prisma.activitySubmission.findUnique({
      where: {
        activityId_telegramUserId: {
          activityId: activity.id,
          telegramUserId: input.telegramUserId,
        },
      },
    });
    if (existing?.verified) {
      return {
        ok: false as const,
        message: "You already earned points for this campaign.",
      };
    }

    const config = parseConfig<SocialConfig>(activity.configJson);
    const proofUrl =
      input.text.match(/https?:\/\/\S+/i)?.[0]?.replace(/[)>.,]+$/, "") ?? "";
    if (!proofUrl) {
      return {
        ok: false as const,
        message: "Paste your retweet/like/profile link so I can verify.",
      };
    }

    const statusMatch = proofUrl.match(TWITTER_STATUS_RE);
    const profileMatch = !statusMatch ? proofUrl.match(TWITTER_PROFILE_RE) : null;
    let verified = Boolean(statusMatch || profileMatch);
    let notes = statusMatch
      ? `status:${statusMatch[1]}`
      : profileMatch
        ? `profile:${profileMatch[1]}`
        : "unrecognized-url";

    // Optional deeper check only when TWITTER_BEARER_TOKEN is set.
    // Missing/empty token must never break verification — URL heuristics still apply.
    const bearer = (process.env.TWITTER_BEARER_TOKEN ?? "").trim();
    if (bearer.length > 0 && statusMatch && config.targetUrl) {
      try {
        const api = await fetch(
          `https://api.twitter.com/2/tweets/${statusMatch[1]}?expansions=referenced_tweets.id&tweet.fields=text,referenced_tweets`,
          {
            headers: { Authorization: `Bearer ${bearer}` },
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (api.ok) {
          const body = (await api.json()) as {
            data?: { referenced_tweets?: Array<{ type: string; id: string }> };
          };
          const targetId = config.targetUrl.match(/status\/(\d+)/i)?.[1];
          const refs = body.data?.referenced_tweets ?? [];
          const action = config.action ?? "retweet";
          if (targetId) {
            verified = refs.some(
              (r) =>
                r.id === targetId &&
                (action === "retweet" || action === "repost"
                  ? r.type === "retweeted"
                  : true),
            );
            notes = verified ? `api-verified:${action}` : "api-mismatch";
          }
        } else {
          // Keep URL-heuristic verification; only annotate the advisory API failure.
          notes = `${notes}|api-http-${api.status}`;
        }
      } catch (err) {
        notes = `${notes}|api-error:${err instanceof Error ? err.message : "fail"}`;
      }
    }

    if (!verified) {
      if (existing) {
        await prisma.activitySubmission.update({
          where: { id: existing.id },
          data: { payload: proofUrl, notes, verified: false },
        });
      } else {
        await prisma.activitySubmission.create({
          data: {
            activityId: activity.id,
            telegramUserId: input.telegramUserId,
            username: input.username ?? null,
            payload: proofUrl,
            verified: false,
            pointsAwarded: 0,
            notes,
          },
        });
      }
      return {
        ok: false as const,
        message:
          "Could not verify that interaction yet. Double-check the link and tag me again.",
      };
    }

    const points = activity.pointsReward;
    if (existing) {
      await prisma.activitySubmission.update({
        where: { id: existing.id },
        data: {
          payload: proofUrl,
          verified: true,
          pointsAwarded: points,
          notes,
        },
      });
    } else {
      await prisma.activitySubmission.create({
        data: {
          activityId: activity.id,
          telegramUserId: input.telegramUserId,
          username: input.username ?? null,
          payload: proofUrl,
          verified: true,
          pointsAwarded: points,
          notes,
        },
      });
    }

    await rewardService.awardPoints({
      groupId: activity.groupId,
      telegramUserId: input.telegramUserId,
      username: input.username,
      points,
      reason: `social:${activity.title}`,
      activityId: activity.id,
    });

    return {
      ok: true as const,
      message: `Verified — +${points} points. Nice work!`,
      points,
    };
  }

  /** Find active social campaign matching text / reply context. */
  async findOpenSocial(groupId: string) {
    return prisma.engagementActivity.findFirst({
      where: { groupId, type: "social", status: "active" },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Soft fun offer cadence. */
  async maybeOfferFun(input: {
    groupId: string;
    send: (text: string) => Promise<unknown>;
  }) {
    const settings = await prisma.groupSettings.findUnique({
      where: { groupId: input.groupId },
    });
    if (!settings) return false;
    const anyFun =
      settings.allowFun ||
      settings.allowGames ||
      settings.allowPolls ||
      settings.allowComics;
    if (!anyFun) return false;
    const interval = settings.funPromptIntervalHours ?? 48;
    if (interval <= 0) return false;
    const last = settings.lastFunPromptAt?.getTime() ?? 0;
    if (Date.now() - last < interval * 60 * 60 * 1000) return false;

    const bits: string[] = [];
    if (settings.allowPolls) bits.push("a quick poll");
    if (settings.allowGames || settings.allowFun) bits.push("trivia / learn-and-earn");
    if (settings.allowComics) bits.push("a light comic beat");
    if (settings.allowSocialCampaigns) bits.push("a social challenge");

    await input.send(
      `Anyone up for something fun? I can run ${bits.join(", ") || "a short activity"}. Ask me what's available, or say "start poll" / "start quiz" and tag me.`,
    );
    await prisma.groupSettings.update({
      where: { groupId: input.groupId },
      data: { lastFunPromptAt: new Date() },
    });
    return true;
  }

  extractUrl(text: string) {
    return text.match(/https?:\/\/\S+/i)?.[0]?.replace(/[)>.,]+$/, "") ?? null;
  }
}

export const engagementService = new EngagementService();
