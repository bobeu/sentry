/**
 * Thin wrappers so `npm run vol:<name>` maps 1:1 to blockchain.service methods.
 * Example: npm run vol:transfer -- --count 5 --txcount 3 --wait 2000 --amount 0.0001
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

const command = process.argv[2];
if (!command) {
  console.error("Usage: tsx tests/scripts/invoke.ts <command> [...flags]");
  process.exit(1);
}

const runTs = resolve(__dirname, "..", "run.ts");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", runTs, command, ...process.argv.slice(3)],
  { stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
