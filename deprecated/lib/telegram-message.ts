/** Telegram Bot API hard limit for a single message. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Split long text into Telegram-safe chunks, preferring paragraph/line/space breaks.
 */
export function splitTelegramMessage(
  text: string,
  maxLen = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;

    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function escapeTelegramHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Strip LLM formatting garbage that confuses readers (stray *, # walls, mixed symbols).
 */
export function sanitizeLlmFormatting(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Remove zero-width / odd symbols often hallucinated into replies
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Collapse runs of decorative symbols (****, ####, ---- alone)
  text = text.replace(/^[ \t]*[*#_\-=~]{3,}[ \t]*$/gm, "");
  // Fix "word*word" mid-token star clutter → space
  text = text.replace(/(\w)\*{2,}(\w)/g, "$1 $2");
  // Normalize weird bullet glyphs
  text = text.replace(/^[ \t]*[•●▪︎◦‣▸►]+[ \t]*/gm, "• ");
  text = text.replace(/^[ \t]*[\*\-–—]+[ \t]+/gm, "• ");
  // Drop markdown tables (Telegram can't render them well)
  if (/\|.+\|/.test(text) && text.includes("---")) {
    text = text
      .split("\n")
      .filter((line) => !/^\s*\|?\s*-{2,}/.test(line))
      .map((line) =>
        line.includes("|")
          ? "• " +
            line
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean)
              .join(" — ")
          : line,
      )
      .join("\n");
  }
  // Max 2 blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/**
 * Convert common Markdown-ish LLM output into Telegram HTML.
 * Avoids raw `*` clutter by mapping emphasis to real bold/italic/underline.
 */
export function toTelegramHtml(raw: string): string {
  let text = sanitizeLlmFormatting(raw);
  if (!text) return "";

  const vault: string[] = [];
  const stash = (value: string) => {
    vault.push(value);
    return `\u0000${vault.length - 1}\u0000`;
  };

  text = text.replace(/```([\s\S]*?)```/g, (_, code: string) =>
    stash(`<pre>${escapeTelegramHtml(code.replace(/^\n|\n$/g, ""))}</pre>`),
  );
  text = text.replace(/`([^`\n]+)`/g, (_, code: string) =>
    stash(`<code>${escapeTelegramHtml(code)}</code>`),
  );

  // Links [label](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label: string, url: string) =>
      stash(
        `<a href="${escapeTelegramHtml(url)}">${escapeTelegramHtml(label)}</a>`,
      ),
  );

  text = escapeTelegramHtml(text);

  // Headings → bold line
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Bold / italic / underline / strike (order matters)
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_]+)__/g, "<u>$1</u>");
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  text = text.replace(
    /(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g,
    "$1<i>$2</i>",
  );
  text = text.replace(
    /(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g,
    "$1<i>$2</i>",
  );
  // ||spoiler||
  text = text.replace(/\|\|([^|]+)\|\|/g, "<tg-spoiler>$1</tg-spoiler>");

  // Stray emphasis markers left over
  text = text.replace(/(^|\s)\*(\s|$)/g, "$1$2");
  text = text.replace(/\*/g, "");
  text = text.replace(/(^|\s)_(?=\s|$)/g, "$1");

  // Restore stashed segments
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => vault[Number(i)] ?? "");

  return text;
}

/**
 * Mathematical Sans-Serif Bold mapping — Telegram can't set Comic Sans, so this
 * gives Sentry a distinct "display" look that stands out from normal group text.
 * Skips URLs, HTML tags, and code-ish tokens.
 */
const COMIC_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upperComic = "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭";
  const lowerComic = "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇";
  // Each mathematical bold letter is 2 UTF-16 code units — iterate by code points
  const up = [...upperComic];
  const lo = [...lowerComic];
  for (let i = 0; i < 26; i++) {
    map[upper[i]!] = up[i]!;
    map[lower[i]!] = lo[i]!;
  }
  const digits = "0123456789";
  const digComic = [..."𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"];
  for (let i = 0; i < 10; i++) map[digits[i]!] = digComic[i]!;
  return map;
})();

export function toComicDisplay(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    // Preserve HTML tags
    if (text[i] === "<") {
      const end = text.indexOf(">", i);
      if (end !== -1) {
        out += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    // Preserve URLs
    if (text.slice(i).match(/^https?:\/\//i)) {
      const m = text.slice(i).match(/^https?:\/\/\S+/i);
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    const ch = text[i]!;
    out += COMIC_MAP[ch] ?? ch;
    i += 1;
  }
  return out;
}

/**
 * Final envelope for every Sentry reply.
 * Brand header only — body stays normal weight so **bold** is reserved for real emphasis.
 */
export function formatSentryMessage(raw: string, _opts?: { comic?: boolean }): string {
  let body = toTelegramHtml(raw);
  if (!body) return "";
  // Prefer clear paragraphs (blank line between blocks)
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  const header = "<b>🎭 Sentry</b> <i>· AI teammate</i>";
  return `<blockquote>${header}</blockquote>\n\n${body}`;
}

function normalizeIntentText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the message is only gratitude / acknowledgment (no new question). */
export function isGratitudeOnly(text: string) {
  const t = normalizeIntentText(text);
  if (!t || t.length > 100) return false;
  const bare = t
    .replace(/\b(sentry|tgemployee[_\s]?bot)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare || bare.length > 80) return false;
  return /^(thanks|thank you|thank u|thx|ty|tysm|thankya|thankya|appreciate(?:\s+it)?|appreciated|grateful|much appreciated|ok thanks|okay thanks|cool thanks|got it|perfect|awesome thanks|cheers|nice one|many thanks|thanks a lot|thanks so much|thank you so much|thnks|thnx)(?:\s+(so much|a lot|again|mate|bro|sis|friend|guys|team))?$/.test(
    bare,
  );
}

/**
 * Casual greeting / vibe check with no real question.
 */
export function isCasualGreeting(text: string) {
  const t = normalizeIntentText(text)
    .replace(/\b(sentry|tgemployee[_\s]?bot)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 60) return false;
  if (
    /\b(what|who|when|where|why|how|can you|could you|please|help|faq|price|wallet|deposit)\b/.test(
      t,
    )
  ) {
    return false;
  }
  return /^(hi|hii+|hello|heya?|hey|yo|sup|what'?s up|whats up|good (morning|afternoon|evening|day)|gm|gn|howdy|hiya)(?:\s+\w+){0,4}$/.test(
    t,
  );
}

/** Explicit help / capabilities request (not a bare hi). */
export function isHelpRequest(text: string) {
  const t = normalizeIntentText(text)
    .replace(/\b(sentry|tgemployee[_\s]?bot)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  return /^(help|commands?|menu|what can you do|who are you|your (capabilities|features)|how do you work)\b/.test(
    t,
  );
}

export const GRATITUDE_ACK =
  "You're welcome — happy to help. Ping me anytime if you need anything else.";

export function casualGreetingReply(
  memberName?: string | null,
  funHint?: string | null,
) {
  const who = memberName ? ` ${memberName}` : "";
  const fun = funHint?.trim() ? `\n\n${funHint.trim()}` : "";
  return `Hey${who} — good to see you. What can I help with?${fun}`;
}
