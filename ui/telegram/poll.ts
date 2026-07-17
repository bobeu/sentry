import { getBot } from "@/services/telegram.service";

async function main() {
  const bot = getBot();
  console.log("[telegram] starting long polling...");
  await bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  console.error("[telegram] failed to start", error);
  process.exit(1);
});
