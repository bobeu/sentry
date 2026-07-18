import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ take: 1 });
  console.log("✅ Connected");
  console.log(`Users readable: ${users.length >= 0 ? "yes" : "no"}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Prisma verification failed:");
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
