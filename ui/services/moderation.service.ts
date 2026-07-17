export type ModerationVerdict = {
  spam: boolean;
  reason?: string;
  confidence: number;
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

function emojiRatio(text: string) {
  const chars = [...text];
  if (chars.length === 0) return 0;
  const emoji = chars.filter((c) => /\p{Extended_Pictographic}/u.test(c)).length;
  return emoji / chars.length;
}

export class ModerationService {
  private recentByUser = new Map<string, { text: string; at: number }[]>();

  inspect(input: {
    text: string;
    fromUserId?: string | null;
    groupId: string;
  }): ModerationVerdict {
    const text = input.text.trim();
    if (!text) return { spam: false, confidence: 0 };

    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(text)) {
        return { spam: true, reason: "scam_link_or_phrase", confidence: 0.95 };
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

    // Repeated messages from same user in the same group window
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

    // Obvious spam: same char spam / very long URLs only
    if (/^(.)\1{15,}$/.test(text.replace(/\s/g, ""))) {
      return { spam: true, reason: "obvious_spam", confidence: 0.85 };
    }

    return { spam: false, confidence: 0.1 };
  }
}

export const moderationService = new ModerationService();
