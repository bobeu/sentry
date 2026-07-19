import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function requireDatabaseUrl(): string {
  // Prefer the pooled URL on Prisma Compute (DATABASE_URL_POOLED); fall back to DATABASE_URL.
  // Use dynamic lookup so Next.js does not inline a build-time .env value into the server bundle.
  const connectionString =
    process.env["DATABASE_URL_POOLED"]?.trim() ||
    process.env["DATABASE_URL"]?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_POOLED or DATABASE_URL must be set before creating the Prisma client.",
    );
  }
  return connectionString;
}

/** Shared Prisma Client singleton for server-side code only. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
