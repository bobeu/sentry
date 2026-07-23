import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { PRICING_LABELS } from "@/lib/pricing";
import { groupService } from "@/services/group.service";

export type EmployerIntent =
  | "report"
  | "status"
  | "work"
  | "help"
  | "spam"
  | "employment"
  | "agreement"
  | "rewards"
  | "engagement"
  | "general";

export function detectEmployerIntent(text: string): EmployerIntent {
  const t = text.toLowerCase().trim();
  if (!t) return "help";
  if (
    /\b(agreement|contract|terms of (employment|service)|employment agreement|show (me )?(the )?agreement|read (the )?agreement)\b/.test(
      t,
    )
  ) {
    return "agreement";
  }
  if (
    /\b(start|launch|create|end|close|stop)\b.*\b(poll|trivia|quiz|activity)\b/.test(t) ||
    /\b(poll|trivia|quiz)\b.*\b(start|launch|create|end|close|stop)\b/.test(t) ||
    /\b(humor|jokes?|comedy|be\s+funny|tone)\b/.test(t)
  ) {
    return "engagement";
  }
  if (
    /\b(reward account|create reward|pause reward|resume reward|points|leaderboard|engagement|allow[- ]?(games|polls|fun)|cash reward)\b/.test(
      t,
    )
  ) {
    return "rewards";
  }
  if (
    /\b(spam|moderat|removed|deleted|ban(ned)?|mute(d)?|how many.*(spam|message))\b/.test(
      t,
    )
  ) {
    return "spam";
  }
  if (
    /\b(employment|hire|salary|charge|billing|what do you (cost|charge)|prepaid)\b/.test(
      t,
    )
  ) {
    return "employment";
  }
  if (
    /\b(full report|report|briefing|digest|recap|summar(y|ize|ise))\b/.test(t)
  ) {
    return "report";
  }
  if (
    /\b(work report|past work|what (have|did) you (done|do)|activity log|actions? (today|taken)|your work)\b/.test(
      t,
    )
  ) {
    return "work";
  }
  if (
    /\b(group status|status|how is (the )?group|enabled groups?|community mode|wallet|balance|funding)\b/.test(
      t,
    )
  ) {
    return "status";
  }
  if (/^(hi|hello|hey|help|commands?|what can you do|who are you|menu)\b/.test(t)) {
    return "help";
  }
  return "general";
}

function fmtDate(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function metaActionTaken(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.actionTaken === "string" ? m.actionTaken : null;
}

export class EmployerAgentService {
  async buildSpamBrief(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today, recent, groups] = await Promise.all([
      prisma.actionRecord.findMany({
        where: {
          userId,
          type: "spam_moderation",
          completedAt: { gte: startOfDay },
        },
        include: { group: { select: { name: true, telegramId: true } } },
      }),
      prisma.actionRecord.findMany({
        where: { userId, type: "spam_moderation" },
        orderBy: { completedAt: "desc" },
        take: 20,
        include: { group: { select: { name: true, telegramId: true } } },
      }),
      groupService.listForUser(userId),
    ]);

    let deleted = 0;
    let warned = 0;
    let muted = 0;
    let banned = 0;
    for (const a of today) {
      const taken = metaActionTaken(a.metadata);
      if (taken === "delete") deleted++;
      else if (taken === "mute") muted++;
      else if (taken === "ban") banned++;
      else warned++;
    }

    const lines = [
      "Spam & moderation (I'm your community employee — I do remove spam when I'm admin)",
      "",
      `Today: ${today.length} moderation events`,
      `  · messages removed: ${deleted}`,
      `  · warns / flags: ${warned}`,
      `  · mutes: ${muted}`,
      `  · bans: ${banned}`,
      "",
      "Per group (dashboard spam count = moderation events today):",
      ...groups.map(
        (g) =>
          `- ${g.name ?? g.telegramId}: spam events today=${g.spamRemoved} · community=${g.enabled ? "on" : "off"}`,
      ),
      "",
      "Recent moderation:",
      ...recent.slice(0, 10).map((a) => {
        const g = a.group?.name ?? a.group?.telegramId ?? "group";
        const taken = metaActionTaken(a.metadata) ?? "event";
        return `- ${fmtDate(a.completedAt)} · ${g} · ${taken}`;
      }),
    ];
    if (recent.length === 0) {
      lines.push("- (none yet — enable spam moderation and make me a group admin)");
    }
    return lines.join("\n");
  }

  async buildOperationalBrief(userId: string, intent: EmployerIntent) {
    const [stats, groups, recentActions, reports, ledger, spamBrief] =
      await Promise.all([
        actionService.dashboardStats(userId),
        groupService.listForUser(userId),
        actionService.listForUser(userId, 25),
        prisma.report.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { group: { select: { name: true, telegramId: true } } },
        }),
        billingService.getBalanceLedger(userId).catch(() => null),
        intent === "spam" || intent === "general" || intent === "report"
          ? this.buildSpamBrief(userId)
          : Promise.resolve(""),
      ]);

    const groupLines = groups.map((g) => {
      const on = g.enabled ? "enabled" : "disabled";
      return `- ${g.name ?? g.telegramId} (${on}) · faqs=${g.faqCount} · today actions=${g.actionsToday} · spend=${g.todaySpend} · spamEvents=${g.spamRemoved}`;
    });

    const actionLines = recentActions.slice(0, 15).map((a) => {
      const label = PRICING_LABELS[a.type] ?? a.type;
      const g = a.group?.name ?? a.group?.telegramId ?? "dm/global";
      return `- ${fmtDate(a.completedAt)} · ${label} · ${g}${a.billable ? "" : " (non-billable)"}`;
    });

    const reportLines = reports.map((r) => {
      const g = r.group?.name ?? r.group?.telegramId ?? "general";
      const preview = (r.content ?? "").replace(/\s+/g, " ").slice(0, 180);
      return `- ${fmtDate(r.createdAt)} · ${g}: ${preview || "(empty)"}`;
    });

    const sections = [
      "Role: Sentry is the employer's hired Telegram community employee (moderate, answer, report), paid from a prepaid Celo wallet.",
      "",
      "Employment dashboard snapshot",
      `Actions completed (all-time): ${stats.actionsCompleted}`,
      `Actions today: ${stats.actionsCompletedToday}`,
      `Groups connected: ${stats.groupsConnected} (enabled: ${stats.groupsEnabled})`,
      `Today spend: ${stats.todaySpend}`,
      `Lifetime spend: ${stats.lifetimeSpend}`,
      ledger
        ? `Wallet available: ${ledger.availableBalance} ${ledger.currency} (on-chain ${ledger.onChainBalance}, outstanding ${ledger.outstandingCharges})`
        : "Wallet available: (unavailable)",
      "",
      "Groups I manage:",
      groupLines.length ? groupLines.join("\n") : "- (none linked)",
    ];

    if (spamBrief) {
      sections.push("", spamBrief);
    }

    if (intent === "work" || intent === "report" || intent === "general") {
      sections.push("", "Recent work:", actionLines.length ? actionLines.join("\n") : "- (none yet)");
    }
    if (intent === "report" || intent === "general") {
      sections.push(
        "",
        "Saved summaries/reports:",
        reportLines.length ? reportLines.join("\n") : "- (none yet)",
      );
    }
    if (intent === "status" || intent === "employment" || intent === "agreement") {
      sections.push(
        "",
        "Employment agreement (summary):",
        "- Employer must Accept the Employment Agreement at hire; Reject cancels hire with no action.",
        "- Employer hires Sentry, funds the employment wallet on Celo, enables groups.",
        "- Each completed billable action creates a charge; settlements run on-chain.",
        "- Sentry stops billable work when available balance is exhausted.",
        "- Privacy: group content used only for hired duties; Employer controls FAQs/KB/playbook.",
        "- Employer may re-read the full agreement anytime via /agreement or Menu → Agreement.",
      );
    }

    return sections.join("\n");
  }

  async formatDirectReport(userId: string, intent: EmployerIntent) {
    if (intent === "spam") return this.buildSpamBrief(userId);
    if (intent === "agreement") {
      const { employmentService } = await import("@/services/employment.service");
      const agreement = await employmentService.getAgreement(userId);
      return [
        agreement.title,
        `Version ${agreement.version}`,
        agreement.acceptedCurrent
          ? "You have accepted this version for employment."
          : "Not yet accepted for the current version — required before hire.",
        "",
        agreement.text,
      ].join("\n");
    }
    const brief = await this.buildOperationalBrief(userId, intent);
    if (intent === "status") return `Group & employment status\n\n${brief}`;
    if (intent === "work") return `Past work report\n\n${brief}`;
    if (intent === "report") return `Full Sentry report\n\n${brief}`;
    if (intent === "employment") return `Employment & billing\n\n${brief}`;
    if (intent === "rewards" || intent === "engagement") {
      return this.buildRewardsBrief(userId);
    }
    return brief;
  }

  async buildRewardsBrief(userId: string) {
    const groups = await groupService.listForUser(userId);
    const { rewardService } = await import("@/services/reward.service");
    const { blockchainService } = await import("@/services/blockchain.service");
    const lines: string[] = [
      "Engagement & rewards",
      "",
      `RewardFactory configured: ${blockchainService.isRewardFactoryConfigured() ? "yes" : "NO — sync RewardFactory via smartContracts sync-data after deploy"}`,
      "",
      "Rewards: create reward account for <group>, pause rewards, resume rewards.",
      "Polls: start poll in <group>, end poll in <group>, start quiz in <group>.",
      "Humor: humor witty | humor wholesome | humor off (for a group).",
      "Dashboard: group → Capabilities → Engagement & Rewards.",
      "",
    ];
    for (const g of groups.slice(0, 8)) {
      const account = await rewardService.getAccount(g.id);
      const s = g.settings;
      lines.push(
        `• ${g.name ?? g.telegramId}: fun=${s?.allowFun ? "on" : "off"} games=${s?.allowGames ? "on" : "off"} polls=${s?.allowPolls ? "on" : "off"} social=${s?.allowSocialCampaigns ? "on" : "off"} | humor=${s?.humorEnabled === false || s?.humorStyle === "off" ? "off" : s?.humorStyle ?? "friendly"} | rewards=${s?.rewardEnabled ? (s.rewardPaused ? "paused" : "on") : "off"} | account=${account?.address ?? "(none)"}`,
      );
    }
    return lines.join("\n");
  }

  /**
   * Handle employer natural-language reward account ops. Returns reply text or null.
   */
  async tryHandleRewardCommand(userId: string, text: string): Promise<string | null> {
    const t = text.toLowerCase();
    const { rewardService } = await import("@/services/reward.service");
    const { blockchainService } = await import("@/services/blockchain.service");
    const groups = await groupService.listForUser(userId);

    const pickGroup = () => {
      const byName = groups.find((g) =>
        (g.name ?? "").toLowerCase() && t.includes((g.name ?? "").toLowerCase()),
      );
      return byName ?? groups[0] ?? null;
    };

    if (/\b(create|ensure|open)\b.*\breward\b/.test(t) || /\breward account\b/.test(t)) {
      const g = pickGroup();
      if (!g) return "No groups linked yet. Enable a group first.";
      if (!blockchainService.isRewardFactoryConfigured()) {
        return "RewardFactory is not synced yet. Deploy on Celo, run sync-data, then ask me again.";
      }
      try {
        const account = await rewardService.ensureRewardAccount({
          groupId: g.id,
          ownerUserId: userId,
        });
        await rewardService.setRewardConfig(g.id, {
          rewardEnabled: true,
          rewardPaused: false,
        });
        return [
          `Reward account ready for ${g.name ?? g.telegramId}.`,
          `Address: ${account.address}`,
          `Currency: ${account.currency}`,
          "Fund this address (not your employment wallet). Members withdraw by tagging Sentry with their 0x wallet.",
        ].join("\n");
      } catch (err) {
        return err instanceof Error ? err.message : "Could not create reward account.";
      }
    }

    if (/\bpause\b.*\breward/.test(t)) {
      const g = pickGroup();
      if (!g) return "No groups linked.";
      await rewardService.pauseRewards(g.id);
      return `Rewards paused for ${g.name ?? g.telegramId}.`;
    }
    if (/\bresume\b.*\breward/.test(t) || /\bunpause\b.*\breward/.test(t)) {
      const g = pickGroup();
      if (!g) return "No groups linked.";
      await rewardService.resumeRewards(g.id);
      return `Rewards resumed for ${g.name ?? g.telegramId}.`;
    }

    return null;
  }

  /**
   * Employer DM: start/end polls & quizzes in a group, or configure humor.
   */
  async tryHandleEngagementCommand(userId: string, text: string): Promise<string | null> {
    const t = text.toLowerCase();
    const groups = await groupService.listForUser(userId);
    const pickGroup = () => {
      const byName = groups.find((g) => {
        const name = (g.name ?? "").toLowerCase();
        return name && t.includes(name);
      });
      return byName ?? groups[0] ?? null;
    };

    // Humor config: "humor witty", "set humor off for MyGroup"
    const humorMatch = t.match(
      /\b(?:set\s+)?humor(?:\s+style)?\s+(friendly|witty|wholesome|off)\b/,
    ) || t.match(/\b(be\s+funny|jokes?\s+on)\b/) || t.match(/\b(no\s+jokes|humor\s+off)\b/);
    if (humorMatch) {
      const g = pickGroup();
      if (!g) return "No groups linked yet.";
      let style = "friendly";
      if (/\boff\b|no\s+jokes/.test(t)) style = "off";
      else if (/\bwitty\b/.test(t)) style = "witty";
      else if (/\bwholesome\b/.test(t)) style = "wholesome";
      else if (/\bfriendly\b|be\s+funny|jokes?\s+on/.test(t)) style = "friendly";
      await groupService.updateSettings(userId, g.id, {
        humorEnabled: style !== "off",
        humorStyle: style,
      });
      return `Humor set to **${style}** for ${g.name ?? g.telegramId}.`;
    }

    const wantsEnd =
      /\b(end|close|stop|finish)\b/.test(t) &&
      /\b(poll|trivia|quiz|activity|activities)\b/.test(t);
    if (wantsEnd) {
      const g = pickGroup();
      if (!g) return "No groups linked.";
      const { engagementService } = await import("@/services/engagement.service");
      const types = /\bquiz|trivia\b/.test(t)
        ? (["learn", "game"] as const)
        : /\bpoll\b/.test(t)
          ? (["poll"] as const)
          : undefined;
      const result = await engagementService.closeActiveOfTypes(
        g.id,
        types ? [...types] : undefined,
      );
      if (!result.closed) {
        return `No active ${types ? types.join("/") : "activities"} in ${g.name ?? g.telegramId}.`;
      }
      return `Closed ${result.closed} activit${result.closed === 1 ? "y" : "ies"} in ${g.name ?? g.telegramId}:\n${result.titles.map((x) => `• ${x}`).join("\n")}`;
    }

    const wantsStart =
      /\b(start|launch|create|run|host)\b/.test(t) &&
      /\b(poll|trivia|quiz|game|fun|activity)\b/.test(t);
    if (!wantsStart) return null;

    const g = pickGroup();
    if (!g) return "No groups linked.";
    if (!g.enabled) {
      return `${g.name ?? g.telegramId} isn't in community mode yet.`;
    }

    const { engagementService } = await import("@/services/engagement.service");
    const { contextService } = await import("@/services/context.service");
    const { getBot } = await import("@/services/telegram.service");

    const type =
      /\b(trivia|quiz)\b/.test(t)
        ? ("learn" as const)
        : /\bgame\b/.test(t)
          ? ("game" as const)
          : /\bfun\b/.test(t)
            ? ("fun" as const)
            : ("poll" as const);

    if (!engagementService.typeAllowed(type, g.settings)) {
      return `${type} isn't enabled for ${g.name ?? g.telegramId}. Flip it on in the dashboard (Capabilities → Engagement).`;
    }

    try {
      const context = await contextService.build(g.id);
      const activity = await engagementService.inventActivity({
        groupId: g.id,
        type,
        context,
        guidelines: g.settings?.engagementGuidelines,
        createdByUserId: userId,
        hint: text,
      });
      const bot = getBot();
      if (type === "poll" || type === "learn" || type === "game") {
        await engagementService.postTelegramPoll(
          { telegram: bot.telegram, chatId: g.telegramId },
          activity,
          g.settings,
        );
      } else {
        await bot.telegram.sendMessage(
          g.telegramId,
          engagementService.formatActivityBrief(activity, g.settings),
        );
      }
      return [
        `Launched **${activity.title}** (${type}) in ${g.name ?? g.telegramId}.`,
        `Ends: ${activity.closesAt?.toISOString().replace("T", " ").slice(0, 16) ?? "open"} UTC`,
        `Points: ${activity.pointsReward}`,
        "Say `end poll in <group>` when you want it closed.",
      ].join("\n");
    } catch (err) {
      return err instanceof Error ? err.message : "Could not start activity in the group.";
    }
  }

  async formatGroupCard(userId: string, groupId: string) {
    const g = await groupService.getForUser(userId, groupId);
    const s = g.settings;
    return [
      `Group: ${g.name ?? g.telegramId}`,
      `Community mode: ${g.enabled ? "ON" : "OFF"}`,
      `Spam moderation: ${s?.spamModeration ? "ON" : "OFF"}`,
      `Q&A: ${s?.answerQuestions ? "ON" : "OFF"}`,
      `Mentions: ${s?.replyToMentions ? "ON" : "OFF"}`,
      `Work report every: ${s?.workReportIntervalHours ?? 24}h`,
      `Today: actions=${g.actionsToday} spamEvents=${g.spamRemoved} spend=${g.todaySpend}`,
      `FAQs: ${g.faqs?.length ?? 0}`,
      "",
      "I work here as your employee: answer with FAQs/KB, moderate spam, welcome members, and report back.",
    ].join("\n");
  }
}

export const employerAgentService = new EmployerAgentService();
