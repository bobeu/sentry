export type ModerationVerdict = {
  spam: boolean;
  reason?: string;
  confidence: number;
  matchedGuideline?: string;
};

const SCAM_PATTERNS = [
  /t\.me\/\+|joinchat/i,
  /free\s*(nitro|crypto|airdrop)/i,
  /claim\s*(now|reward|prize)/i,
  /seed\s*phrase/i,
  /connect\s*wallet.*urgent/i,
  /https?:\/\/\S*(bit\.ly|tinyurl|cutt\.ly)\S*/i,
];

const OFFENSIVE = [
  /\bf+u+c+k+\b/i,
  /\bs+h+i+t+\b/i,
  /\basshole\b/i,
  /\bnig+er\b/i,
  /\bslut\b/i,
];

/** Common low-signal spam phrases employers often want flagged. */
const DEFAULT_SOFT_SPAM = [
  /when\s+list(ing|s)?\b/i,
  /any\s+update\s*\?/i,
  /dm\s+me\s+for\s+(signal|call|profit)/i,
  /guaranteed\s+profit/i,
];

function emojiRatio(text: string) {
  const chars = [...text];
  if (chars.length === 0) return 0;
  const emoji = chars.filter((c) => /\p{Extended_Pictographic}/u.test(c)).length;
  return emoji / chars.length;
}

function guidelineLines(guidelines?: string | null) {
  if (!guidelines?.trim()) return [];
  return guidelines
    .split(/\n|;(?=\s)/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
}

export class ModerationService {
  private recentByUser = new Map<string, { text: string; at: number }[]>();
  /** Soft-warn streak per group:user for escalation. */
  private warnStreak = new Map<string, { count: number; at: number }>();

  inspect(input: {
    text: string;
    fromUserId?: string | null;
    groupId: string;
    spamGuidelines?: string | null;
    hasMedia?: boolean;
  }): ModerationVerdict {
    const text = input.text.trim();
    const guidelines = guidelineLines(input.spamGuidelines);

    if (input.hasMedia) {
      const mediaGuide = guidelines.find((g) =>
        /image|photo|picture|media|sticker|gif|video|irrelevant\s+image/i.test(g),
      );
      if (mediaGuide || /no\s+(random\s+)?(images?|photos?|media)/i.test(input.spamGuidelines ?? "")) {
        return {
          spam: true,
          reason: "irrelevant_or_disallowed_media",
          confidence: 0.72,
          matchedGuideline: mediaGuide,
        };
      }
    }

    if (!text && !input.hasMedia) return { spam: false, confidence: 0 };

    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(text)) {
        return { spam: true, reason: "scam_link_or_phrase", confidence: 0.95 };
      }
    }

    for (const line of guidelines) {
      // Treat short guideline lines as phrase contains; longer as keyword bag.
      const needle = line.replace(/^[-*•\d.)\s]+/, "").trim();
      if (needle.length < 2) continue;
      if (needle.length <= 48) {
        if (text.toLowerCase().includes(needle.toLowerCase())) {
          return {
            spam: true,
            reason: "employer_guideline_match",
            confidence: 0.78,
            matchedGuideline: line,
          };
        }
      } else {
        const tokens = needle
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 3)
          .slice(0, 6);
        const hits = tokens.filter((t) => text.toLowerCase().includes(t)).length;
        if (tokens.length >= 2 && hits >= Math.ceil(tokens.length * 0.6)) {
          return {
            spam: true,
            reason: "employer_guideline_match",
            confidence: 0.7,
            matchedGuideline: line,
          };
        }
      }
    }

    for (const pattern of DEFAULT_SOFT_SPAM) {
      if (pattern.test(text)) {
        return { spam: true, reason: "low_signal_spam_phrase", confidence: 0.65 };
      }
    }

    if (emojiRatio(text) > 0.6 && text.length > 12) {
      return { spam: true, reason: "excessive_emojis", confidence: 0.8 };
    }

    for (const pattern of OFFENSIVE) {
      if (pattern.test(text)) {
        return { spam: true, reason: "offensive_language", confidence: 0.75 };
      }
    }

    if (input.fromUserId) {
      const key = `${input.groupId}:${input.fromUserId}`;
      const now = Date.now();
      const bucket = (this.recentByUser.get(key) ?? []).filter((r) => now - r.at < 60_000);
      const repeats = bucket.filter((r) => r.text === text).length;
      bucket.push({ text, at: now });
      this.recentByUser.set(key, bucket.slice(-10));
      if (repeats >= 2) {
        return { spam: true, reason: "repeated_message", confidence: 0.9 };
      }
    }

    if (/^(.)\1{15,}$/.test(text.replace(/\s/g, ""))) {
      return { spam: true, reason: "obvious_spam", confidence: 0.85 };
    }

    return { spam: false, confidence: 0.1 };
  }

  noteWarning(groupId: string, userId: string) {
    const key = `${groupId}:${userId}`;
    const prev = this.warnStreak.get(key);
    const now = Date.now();
    if (!prev || now - prev.at > 24 * 3600_000) {
      this.warnStreak.set(key, { count: 1, at: now });
      return 1;
    }
    const count = prev.count + 1;
    this.warnStreak.set(key, { count, at: now });
    return count;
  }

  warnCount(groupId: string, userId: string) {
    const prev = this.warnStreak.get(`${groupId}:${userId}`);
    if (!prev || Date.now() - prev.at > 24 * 3600_000) return 0;
    return prev.count;
  }
}

export const moderationService = new ModerationService();
