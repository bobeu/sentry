import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations need a direct, session-persistent connection. Runtime queries use
  // DATABASE_URL via the PrismaPg adapter and may use a pooled connection.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
