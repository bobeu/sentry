/**
 * One-shot migrate using a local env file. Does not print secret values.
 * Usage: node scripts/run-migrate-from-env.mjs .env.prisma.deploy
 */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

const file = resolve(process.argv[2] || ".env.prisma.deploy");
if (!existsSync(file)) {
  console.error("Missing env file:", file);
  process.exit(1);
}

const env = { ...process.env };
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

for (const k of ["DIRECT_URL", "DATABASE_URL"]) {
  const v = env[k] || "";
  const scheme = v.split(":")[0] || "(empty)";
  console.log(`${k}: present=${Boolean(v)} scheme=${scheme} len=${v.length}`);
}

if (!env.DIRECT_URL?.startsWith("postgres")) {
  console.error("DIRECT_URL must be a postgres connection string");
  process.exit(1);
}

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env,
  shell: true,
  cwd: resolve("."),
});
process.exit(r.status ?? 1);
