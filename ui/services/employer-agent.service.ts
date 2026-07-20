import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";
import { billingService } from "@/services/billing.service";
import { PRICING_LABELS } from "@/lib/pricing";
import { groupService } from "@/services/group.service";

export type EmployerIntent = "report" | "status" | "work" | "help" | "general";

export function detectEmployerIntent(text: string): EmployerIntent {
  const t = text.toLowerCase().trim();
  if (!t) return "help";
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
  if (/^(hi|hello|hey|help|commands?|what can you do|who are you)\b/.test(t)) {
    return "help";
  }
  return "general";
}

function fmtDate(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export class EmployerAgentService {
  async buildOperationalBrief(userId: string, intent: EmployerIntent) {
    const [stats, groups, recentActions, reports, ledger] = await Promise.all([
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
    ]);

    const groupLines = groups.map((g) => {
      const on = g.enabled ? "enabled" : "disabled";
      return `- ${g.name ?? g.telegramId} (${on}) · faqs=${g.faqCount} · today actions=${g.actionsToday} · spend=${g.todaySpend}`;
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
      "Groups:",
      groupLines.length ? groupLines.join("\n") : "- (none linked)",
    ];

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
    if (intent === "status") {
      sections.push(
        "",
        "Per-group today:",
        groups
          .map(
            (g) =>
              `- ${g.name ?? g.telegramId}: mentions=${g.mentionsHandled} spam=${g.spamRemoved} summary=${g.summaryStatus}`,
          )
          .join("\n") || "- (none)",
      );
    }

    return sections.join("\n");
  }

  async formatDirectReport(userId: string, intent: EmployerIntent) {
    const brief = await this.buildOperationalBrief(userId, intent);
    if (intent === "status") {
      return `Group & employment status\n\n${brief}`;
    }
    if (intent === "work") {
      return `Past work report\n\n${brief}`;
    }
    if (intent === "report") {
      return `Full Sentry report\n\n${brief}`;
    }
    return brief;
  }
}

export const employerAgentService = new EmployerAgentService();
