/**
 * Normalize Telegram chat IDs for lookup / storage.
 * Supergroups are usually `-100XXXXXXXXXX`. Users often paste without the leading `-`.
 */
export function normalizeTelegramChatId(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return trimmed;

  // Already a signed numeric id
  if (/^-?\d+$/.test(trimmed)) {
    if (trimmed.startsWith("-")) return trimmed;
    // Classic groups are small negative ids; channels/supergroups use -100 prefix.
    // If the user pasted the absolute part of a -100… id, restore it.
    if (trimmed.startsWith("100") && trimmed.length >= 12) {
      return `-${trimmed}`;
    }
    return trimmed;
  }

  return trimmed;
}

/** Candidate IDs to try when looking up a group the user pasted. */
export function telegramChatIdCandidates(raw: string): string[] {
  const primary = normalizeTelegramChatId(raw);
  const set = new Set<string>([primary, raw.trim()]);
  const digits = raw.trim().replace(/^\+/, "");
  if (/^\d+$/.test(digits)) {
    set.add(digits);
    set.add(`-${digits}`);
    if (!digits.startsWith("100")) set.add(`-100${digits}`);
  }
  return [...set].filter(Boolean);
}
