import type { Hex } from "viem";

/**
 * Normalize a private key from env / accounts.json.
 * Accepts with or without 0x, strips wrapping quotes and whitespace, requires 32-byte hex.
 */
export function normalizePrivateKey(raw: string, label = "private key"): Hex {
  let s = String(raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.toLowerCase().startsWith("0x")) s = s.slice(2);
  s = s.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]{64}$/.test(s)) {
    throw new Error(
      `Invalid ${label}: expected 64 hex chars (optional 0x prefix), got length ${s.length}`,
    );
  }
  return `0x${s}` as Hex;
}
