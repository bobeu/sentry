import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before seeding the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com" },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com" },
  });

  await prisma.wallet.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
      address: "0x1111111111111111111111111111111111111111",
      walletCurrency: "USDm",
      walletStatus: "Active",
      provider: "sentry-wallet-factory",
      balance: 25,
    },
  });

  await prisma.employment.upsert({
    where: { userId: alice.id },
    update: { status: "Active" },
    create: {
      userId: alice.id,
      status: "Active",
      startedAt: new Date(),
    },
  });

  await prisma.settings.upsert({
    where: { userId: bob.id },
    update: { displayName: "Bob" },
    create: {
      userId: bob.id,
      displayName: "Bob",
      timeZone: "UTC",
    },
  });

  console.log("Seeded users:", { alice: alice.email, bob: bob.email });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
