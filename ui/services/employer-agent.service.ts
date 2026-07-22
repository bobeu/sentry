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
    return brief;
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
