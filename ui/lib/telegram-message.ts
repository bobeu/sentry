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
 * Convert common Markdown-ish LLM output into Telegram HTML.
 * Avoids raw `*` clutter by mapping emphasis to real bold/italic.
 */
export function toTelegramHtml(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Normalize fancy / markdown bullets before escaping
  text = text.replace(/^[ \t]*[•●▪︎]\s+/gm, "• ");
  text = text.replace(/^[ \t]*[\*\-]\s+/gm, "• ");

  // Protect fenced / inline code before escaping
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
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) =>
    stash(
      `<a href="${escapeTelegramHtml(url)}">${escapeTelegramHtml(label)}</a>`,
    ),
  );

  text = escapeTelegramHtml(text);

  // Headings → bold line
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Bold / italic (order matters)
  text = text.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_]+)__/g, "<b>$1</b>");
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<b>$2</b>");
  text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, "$1<i>$2</i>");

  // Stray emphasis markers left over
  text = text.replace(/(^|\s)\*(\s|$)/g, "$1$2");
  text = text.replace(/\*/g, "");

  // Restore stashed segments
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => vault[Number(i)] ?? "");

  return text;
}

/** True when the message is only gratitude / acknowledgment (no new question). */
export function isGratitudeOnly(text: string) {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 80) return false;
  return /^(thanks|thank you|thank u|thx|ty|tysm|appreciate it|appreciated|grateful|much appreciated|ok thanks|okay thanks|cool thanks|got it|perfect|awesome thanks|cheers)( .+)?$/.test(
    t,
  );
}

export const GRATITUDE_ACK =
  "You're welcome — happy to help. Ping me anytime if you need anything else.";
