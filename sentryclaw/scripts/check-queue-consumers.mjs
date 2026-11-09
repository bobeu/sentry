#!/usr/bin/env node
import { existsSync } from "node:fs";

// Channel queue consumers replaced by Workflow DevKit (drainChannelWorkflow).
// Only launch-verify still uses @vercel/queue.
const required = [
  "src/app/api/queues/launch-verify/route.ts",
];

const missing = required.filter((file) => !existsSync(file));

if (missing.length > 0) {
  const result = {
    ok: false,
    code: "MISSING_QUEUE_CONSUMER_ROUTES",
    missing,
    checked: required,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

const result = {
  ok: true,
  checked: required,
};
console.log(JSON.stringify(result, null, 2));
