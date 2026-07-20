import { getBot } from "@/services/telegram.service";
import { actionService } from "@/services/action.service";
import { prisma } from "@/lib/prisma";

export type ModerationAction = "ban" | "unban" | "mute" | "unmute";

const MUTE_PERMISSIONS = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false,
};

const UNMUTE_PERMISSIONS = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_change_info: false,
  can_invite_users: true,
  can_pin_messages: false,
  can_manage_topics: false,
};

export function parseDurationSeconds(raw?: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const m = raw.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  if (unit === "s") return n;
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  if (unit === "d") return n * 86400;
  return n * 60;
}

export function resolveTargetUserId(input: {
  replyFromId?: number | null;
  arg?: string | null;
}): string | null {
  if (input.replyFromId != null) return String(input.replyFromId);
  const arg = input.arg?.trim();
  if (!arg) return null;
  if (/^\d+$/.test(arg)) return arg;
  // Username alone cannot be resolved without getChat — require reply or numeric id.
  return null;
}

function roseCommand(
  action: ModerationAction,
  targetUserId: string,
  durationSec?: number,
) {
  const mention = targetUserId;
  if (action === "ban") {
    if (durationSec) {
      const hours = Math.max(1, Math.round(durationSec / 3600));
      return `/tban ${mention} ${hours}h`;
    }
    return `/ban ${mention}`;
  }
  if (action === "unban") return `/unban ${mention}`;
  if (action === "mute") {
    if (durationSec) {
      const hours = Math.max(1, Math.round(durationSec / 3600));
      return `/tmute ${mention} ${hours}h`;
    }
    return `/mute ${mention}`;
  }
  return `/unmute ${mention}`;
}

export class AdminModerationService {
  async execute(input: {
    groupId: string;
    telegramChatId: string;
    employerUserId: string | null;
    billable: boolean;
    action: ModerationAction;
    targetUserId: string;
    durationSec?: number;
    reason?: string;
    roseRelayEnabled: boolean;
    roseBotUsername?: string | null;
  }) {
    const bot = getBot();
    const chatId = Number(input.telegramChatId);
    const userId = Number(input.targetUserId);
    let nativeOk = false;
    let nativeError: string | null = null;

    try {
      if (input.action === "ban") {
        const until_date =
          input.durationSec != null
            ? Math.floor(Date.now() / 1000) + input.durationSec
            : undefined;
        await bot.telegram.callApi("banChatMember", {
          chat_id: chatId,
          user_id: userId,
          until_date,
        });
        nativeOk = true;
      } else if (input.action === "unban") {
        await bot.telegram.callApi("unbanChatMember", {
          chat_id: chatId,
          user_id: userId,
          only_if_banned: true,
        });
        nativeOk = true;
      } else if (input.action === "mute") {
        const until_date =
          input.durationSec != null
            ? Math.floor(Date.now() / 1000) + input.durationSec
            : Math.floor(Date.now() / 1000) + 365 * 86400;
        await bot.telegram.callApi("restrictChatMember", {
          chat_id: chatId,
          user_id: userId,
          permissions: MUTE_PERMISSIONS,
          until_date,
        });
        nativeOk = true;
      } else {
        await bot.telegram.callApi("restrictChatMember", {
          chat_id: chatId,
          user_id: userId,
          permissions: UNMUTE_PERMISSIONS,
        });
        nativeOk = true;
      }
    } catch (err) {
      nativeError = err instanceof Error ? err.message : String(err);
    }

    let roseOk = false;
    let roseError: string | null = null;
    if (input.roseRelayEnabled) {
      const cmd = roseCommand(input.action, input.targetUserId, input.durationSec);
      try {
        await bot.telegram.sendMessage(chatId, cmd);
        roseOk = true;
        if (input.employerUserId) {
          await actionService.record({
            type: "rose_relay",
            groupId: input.groupId,
            userId: input.employerUserId,
            billable: input.billable,
            metadata: {
              action: input.action,
              targetUserId: input.targetUserId,
              command: cmd,
              rose: input.roseBotUsername ?? "MissRose_bot",
            },
          });
        }
      } catch (err) {
        roseError = err instanceof Error ? err.message : String(err);
      }
    }

    if (nativeOk && input.employerUserId) {
      await actionService.record({
        type: "admin_moderation",
        groupId: input.groupId,
        userId: input.employerUserId,
        billable: input.billable,
        metadata: {
          action: input.action,
          targetUserId: input.targetUserId,
          durationSec: input.durationSec ?? null,
          reason: input.reason ?? null,
        },
      });
    }

    if (!nativeOk && !roseOk) {
      throw new Error(
        nativeError
          ? `Moderation failed: ${nativeError}`
          : "Moderation failed (no native rights and Rose relay off or failed).",
      );
    }

    const parts: string[] = [];
    if (nativeOk) parts.push(`Native ${input.action} applied.`);
    else if (nativeError) parts.push(`Native ${input.action} failed: ${nativeError}`);
    if (input.roseRelayEnabled) {
      if (roseOk) {
        parts.push(
          `Rose relay sent (@${(input.roseBotUsername ?? "MissRose_bot").replace(/^@/, "")}). Ensure Rose has /bot2bot admin.`,
        );
      } else if (roseError) {
        parts.push(`Rose relay failed: ${roseError}`);
      }
    }
    return { nativeOk, roseOk, message: parts.join(" ") };
  }

  async syncBotRights(telegramId: string, rights: {
    canDelete?: boolean;
    canRestrict?: boolean;
    canBan?: boolean;
  }) {
    await prisma.telegramGroup.updateMany({
      where: { telegramId },
      data: {
        botCanDelete: rights.canDelete,
        botCanRestrict: rights.canRestrict,
        botCanBan: rights.canBan,
        lastBotEventAt: new Date(),
      },
    });
  }
}

export const adminModerationService = new AdminModerationService();
