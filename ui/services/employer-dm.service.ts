import { prisma } from "@/lib/prisma";
import { getBot } from "@/services/telegram.service";
import { actionService } from "@/services/action.service";
import { groupService } from "@/services/group.service";
import { employerAgentService } from "@/services/employer-agent.service";
import { generateEmployerWelcome } from "@/services/moderation-agent.service";
import { splitTelegramMessage, formatSentryMessage } from "@/lib/telegram-message";

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

function mainMenuKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "My groups", callback_data: "emp:groups" },
        { text: "Work report", callback_data: "emp:report" },
      ],
      [
        { text: "Wallet", callback_data: "emp:wallet" },
        { text: "Spam & moderation", callback_data: "emp:spam" },
      ],
      [
        { text: "Report cadence", callback_data: "emp:cadence" },
        { text: "Agreement", callback_data: "emp:agreement" },
      ],
      [
        { text: "Help", callback_data: "emp:help" },
      ],
    ],
  };
}

function groupsKeyboard(
  groups: Array<{ id: string; name: string | null; telegramId: string; enabled: boolean }>,
): InlineKeyboard {
  const rows = groups.slice(0, 10).map((g, i) => [
    {
      text: `${i + 1}. ${(g.name ?? g.telegramId).slice(0, 28)}${g.enabled ? "" : " (off)"}`,
      callback_data: `emp:group:${g.id}`,
    },
  ]);
  rows.push([{ text: "← Menu", callback_data: "emp:menu" }]);
  return { inline_keyboard: rows };
}

function groupActionsKeyboard(groupId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "Status", callback_data: `emp:gstat:${groupId}` },
        { text: "Toggle community", callback_data: `emp:gtog:${groupId}:enabled` },
      ],
      [
        { text: "Spam on/off", callback_data: `emp:gtog:${groupId}:spamModeration` },
        { text: "Q&A on/off", callback_data: `emp:gtog:${groupId}:answerQuestions` },
      ],
      [
        { text: "Report every 24h", callback_data: `emp:gint:${groupId}:24` },
        { text: "Every 6h", callback_data: `emp:gint:${groupId}:6` },
      ],
      [
        { text: "Every 1h", callback_data: `emp:gint:${groupId}:1` },
        { text: "← Groups", callback_data: "emp:groups" },
      ],
    ],
  };
}

function cadenceKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "All groups: 24h", callback_data: "emp:cadence:all:24" },
        { text: "All: 6h", callback_data: "emp:cadence:all:6" },
      ],
      [
        { text: "All: 1h", callback_data: "emp:cadence:all:1" },
        { text: "← Menu", callback_data: "emp:menu" },
      ],
    ],
  };
}

export class EmployerDmService {
  async sendWelcome(telegramUserId: string, userId: string, displayName?: string) {
    const bot = getBot();
    const brief = await employerAgentService.buildOperationalBrief(userId, "general");
    let welcome: string;
    try {
      welcome = await generateEmployerWelcome({
        displayName,
        operationalBrief: brief,
      });
    } catch {
      welcome = [
        `Hi${displayName ? ` ${displayName}` : ""} — I'm Sentry, your AI Telegram employee.`,
        "I answer FAQs, moderate spam, host polls/trivia with points (and optional cash rewards), and send work reports for your funded groups.",
        "Use the buttons below anytime, or just ask me in plain language.",
      ].join("\n");
    }

    for (const chunk of splitTelegramMessage(welcome)) {
      await bot.telegram
        .sendMessage(Number(telegramUserId), formatSentryMessage(chunk), {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(),
        })
        .catch(() => undefined);
    }
  }

  mainMenuKeyboard() {
    return mainMenuKeyboard();
  }

  async handleCallback(input: {
    data: string;
    userId: string;
    telegramUserId: string;
    answerCb: (text?: string) => Promise<unknown>;
    editOrReply: (text: string, keyboard?: InlineKeyboard) => Promise<unknown>;
  }) {
    const { data, userId, telegramUserId } = input;
    if (!data.startsWith("emp:")) return false;

    if (data === "emp:menu") {
      await input.answerCb("Menu");
      await input.editOrReply(
        "What would you like to do? You can also just type a question.",
        mainMenuKeyboard(),
      );
      return true;
    }

    if (data === "emp:help") {
      await input.answerCb();
      await input.editOrReply(
        [
          "I'm your hired community employee — not a command-line bot.",
          "",
          "• Ask about spam removed, group status, wallet, or employment",
          "• Tap Groups to open settings for each community",
          "• Work report = what I've done recently",
          "• Report cadence = how often I DM you a work summary (default 24h)",
          "",
          "Chat freely; buttons are shortcuts.",
        ].join("\n"),
        mainMenuKeyboard(),
      );
      return true;
    }

    if (data === "emp:report") {
      await input.answerCb("Building report…");
      const report = await employerAgentService.formatDirectReport(userId, "report");
      await input.editOrReply(report.slice(0, 3500), mainMenuKeyboard());
      await actionService.record({
        type: "mention_reply",
        userId,
        billable: true,
        metadata: { channel: "private", intent: "report", via: "button" },
      });
      return true;
    }

    if (data === "emp:spam") {
      await input.answerCb();
      const brief = await employerAgentService.buildSpamBrief(userId);
      await input.editOrReply(brief.slice(0, 3500), mainMenuKeyboard());
      return true;
    }

    if (data === "emp:agreement") {
      await input.answerCb();
      const { employmentService } = await import("@/services/employment.service");
      const { agreementChunksForTelegram } = await import(
        "@/lib/employment-agreement"
      );
      const agreement = await employmentService.getAgreement(userId);
      const chunks = agreementChunksForTelegram(agreement.text);
      await input.editOrReply(
        [
          `${agreement.title}`,
          `Version ${agreement.version}`,
          agreement.acceptedCurrent
            ? "Status: accepted for your current employment."
            : "Status: not yet accepted for the current version (required at hire).",
          "",
          chunks[0] ?? "",
        ]
          .join("\n")
          .slice(0, 3500),
        mainMenuKeyboard(),
      );
      // Follow-up chunks as new messages via bot
      if (chunks.length > 1) {
        const { getBot } = await import("@/services/telegram.service");
        const bot = getBot();
        for (const chunk of chunks.slice(1, 5)) {
          await bot.telegram
            .sendMessage(Number(telegramUserId), chunk)
            .catch(() => undefined);
        }
      }
      return true;
    }

    if (data === "emp:wallet") {
      await input.answerCb();
      const brief = await employerAgentService.buildOperationalBrief(userId, "status");
      const walletLine = brief
        .split("\n")
        .filter((l) => /wallet|spend|balance|Available/i.test(l))
        .join("\n");
      await input.editOrReply(
        walletLine || "Open the dashboard Wallet page to deposit CELO/USDm.",
        mainMenuKeyboard(),
      );
      return true;
    }

    if (data === "emp:groups") {
      await input.answerCb();
      const groups = await groupService.listForUser(userId);
      if (groups.length === 0) {
        await input.editOrReply(
          "No groups linked yet. Add me to a Telegram group, then enable it on the dashboard.",
          mainMenuKeyboard(),
        );
        return true;
      }
      await input.editOrReply(
        "Select a group I manage for you:",
        groupsKeyboard(groups),
      );
      return true;
    }

    if (data === "emp:cadence") {
      await input.answerCb();
      await input.editOrReply(
        "How often should I DM you a work report? Default is every 24 hours.",
        cadenceKeyboard(),
      );
      return true;
    }

    const cadenceAll = data.match(/^emp:cadence:all:(\d+)$/);
    if (cadenceAll) {
      const hours = Number(cadenceAll[1]);
      await this.setCadenceAll(userId, hours);
      await input.answerCb(`Set to ${hours}h`);
      await input.editOrReply(
        `Got it — I'll send work reports about every ${hours} hour(s) for your enabled groups.`,
        mainMenuKeyboard(),
      );
      return true;
    }

    const groupOpen = data.match(/^emp:group:(.+)$/);
    if (groupOpen) {
      const groupId = groupOpen[1];
      await input.answerCb();
      const detail = await employerAgentService.formatGroupCard(userId, groupId);
      await input.editOrReply(detail, groupActionsKeyboard(groupId));
      return true;
    }

    const gstat = data.match(/^emp:gstat:(.+)$/);
    if (gstat) {
      await input.answerCb();
      const detail = await employerAgentService.formatGroupCard(userId, gstat[1]);
      await input.editOrReply(detail, groupActionsKeyboard(gstat[1]));
      return true;
    }

    const gtog = data.match(/^emp:gtog:([^:]+):(\w+)$/);
    if (gtog) {
      const [, groupId, field] = gtog;
      await input.answerCb("Updated");
      await this.toggleGroupSetting(userId, groupId, field);
      const detail = await employerAgentService.formatGroupCard(userId, groupId);
      await input.editOrReply(`Updated.\n\n${detail}`, groupActionsKeyboard(groupId));
      return true;
    }

    const gint = data.match(/^emp:gint:([^:]+):(\d+)$/);
    if (gint) {
      const [, groupId, hoursRaw] = gint;
      const hours = Number(hoursRaw);
      await groupService.updateSettings(userId, groupId, {
        workReportIntervalHours: hours,
      });
      await input.answerCb(`${hours}h`);
      await input.editOrReply(
        `Work report cadence for this group is now every ${hours} hour(s).`,
        groupActionsKeyboard(groupId),
      );
      return true;
    }

    void telegramUserId;
    return false;
  }

  private async setCadenceAll(userId: string, hours: number) {
    const groups = await groupService.listForUser(userId);
    for (const g of groups) {
      await groupService.updateSettings(userId, g.id, {
        workReportIntervalHours: hours,
      });
    }
  }

  private async toggleGroupSetting(userId: string, groupId: string, field: string) {
    const group = await groupService.getForUser(userId, groupId);
    const settings = group.settings;
    if (!settings) return;
    if (field === "enabled") {
      if (settings.enabled) {
        await groupService.disable(userId, groupId);
      } else {
        await groupService.enable(userId, group.telegramId);
      }
      return;
    }
    if (field === "spamModeration") {
      await groupService.updateSettings(userId, groupId, {
        spamModeration: !settings.spamModeration,
      });
      return;
    }
    if (field === "answerQuestions") {
      await groupService.updateSettings(userId, groupId, {
        answerQuestions: !settings.answerQuestions,
      });
    }
  }
}

export const employerDmService = new EmployerDmService();
