import { Prisma } from "@/generated/client";

/**
 * Convert a numeric balance to Prisma.Decimal for Wallet.balance writes.
 * Rejects NaN/Infinity — Prisma reports those as "Argument `balance` is missing".
 */
export function toWalletBalance(value: number | string): Prisma.Decimal {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid wallet balance value: ${String(value)}`);
  }
  return new Prisma.Decimal(amount);
}

export function isFiniteBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
