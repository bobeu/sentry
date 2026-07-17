import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated";
import { SentryError } from "./errors";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set before creating the Prisma client. In production use the pooled connection string.",
    );
  }
  return connectionString;
}

/** Get the shared Prisma client instance for this Node.js process. */
export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
  });
  globalForPrisma.prisma = prisma;
  return prisma;
}

export async function closePrismaClient(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

export class DatabaseClient {
  private readonly client: PrismaClient;

  constructor() {
    this.client = getPrismaClient();
  }

  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(async (tx) => fn(tx));
    } catch {
      throw new SentryError("DB_ERROR", "Database transaction failed");
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

let dbClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient {
  if (!dbClient) dbClient = new DatabaseClient();
  return dbClient;
}