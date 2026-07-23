import type { Context } from "telegraf";
import { prisma } from "@/lib/prisma";
import { rewardService } from "@/services/reward.service";
import { aiService } from "@/services/ai.service";
import type { ContextBundle } from "@/services/context.service";

type ActivityType = "poll" | "game" | "learn" | "social" | "comic" | "fun";

type SocialConfig = {
  platform?: string;
  action?: "like" | "retweet" | "repost" | "follow" | "comment";
  targetUrl: string;
  verifyHint?: string;
};

type QuizConfig = {
  question: string;
  options: string[];
  /** 0-based correct option index */
  correctIndex: number;
  explanation?: string;
};

function parseConfig<T>(raw: string | null | undefined): T {
  try {
    return JSON.parse(raw || "{}") as T;
  } catch {
    return {} as T;
  }
}

export function isEngagementStartCommand(text: string) {
  return /^(?:\/)?(?:start[_-]?)?(?:poll|trivia|quiz|game|fun|learn|comic|social|campaign|activity)\b/i.test(
    text.trim(),
  ) || /\b(start|launch|begin|create)\s+(a\s+)?(poll|trivia|quiz|game|fun|learn|comic|social|campaign|activity)\b/i.test(
    text,
  );
}

export function detectEngagementIntent(text: string): ActivityType | null {
  const t = text.toLowerCase();
  if (/\b(poll|vote)\b/.test(t)) return "poll";
  if (/\b(trivia|quiz|learn\s*and\s*earn|learn)\b/.test(t)) return "learn";
  if (/\b(comic|meme)\b/.test(t)) return "comic";
  if (/\b(twitter|x\.com|retweet|repost|like\s+(the\s+)?(post|tweet)|social\s+campaign)\b/.test(t)) {
    return "social";
  }
  if (/\b(game|play|fun)\b/.test(t)) return "game";
  return null;
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
        closesAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
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

  /** Post a Telegram native poll for a poll/learn activity. */
  async postTelegramPoll(
    ctx: Context,
    activity: {
      id: string;
      title: string;
      description: string | null;
      configJson: string;
      type: string;
    },
  ) {
    const config = parseConfig<QuizConfig & { options?: string[] }>(
      activity.configJson,
    );
    const options =
      config.options?.filter((o) => o.trim()).slice(0, 10) ??
      ["Yes", "No", "Maybe"];
    if (options.length < 2) {
      throw new Error("Poll needs at least 2 options");
    }

    const question = (config.question || activity.title).slice(0, 300);
    const isAnonymous = activity.type === "poll";
    const isQuiz = activity.type === "learn" || activity.type === "game";
    const extra: Record<string, unknown> = {
      is_anonymous: isAnonymous,
      allows_multiple_answers: false,
    };
    if (isQuiz) {
      extra.type = "quiz";
      if (typeof config.correctIndex === "number") {
        extra.correct_option_id = config.correctIndex;
      }
      if (config.explanation) {
        extra.explanation = config.explanation.slice(0, 200);
      }
    }
    const msg = await ctx.telegram.sendPoll(
      ctx.chat!.id,
      question,
      options,
      extra as Parameters<typeof ctx.telegram.sendPoll>[3],
    );

    await prisma.engagementActivity.update({
      where: { id: activity.id },
      data: {
        telegramPollId: "poll" in msg && msg.poll ? msg.poll.id : null,
        telegramMsgId: String(msg.message_id),
      },
    });

    if (activity.description) {
      await ctx.reply(activity.description).catch(() => undefined);
    }

    return msg;
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
      `Anyone up for something fun? I can run ${bits.join(", ") || "a short activity"}. Just say "start poll", "trivia", or "fun" and tag me.`,
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
