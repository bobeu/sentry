import "dotenv/config";
import type { Prisma } from "../generated/prisma/client";
import { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { SentryError } from "./errors";

export type { Prisma };
export { PrismaClient };

/** Get the shared Prisma client instance for this Node.js process. */
export function getPrismaClient(): PrismaClient {
  return prisma;
}

export async function closePrismaClient(): Promise<void> {
  await prisma.$disconnect();
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
