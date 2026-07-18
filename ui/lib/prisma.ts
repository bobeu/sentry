import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set before creating the Prisma client. In production use the pooled Prisma Postgres connection string.",
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
