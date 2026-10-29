import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { githubPlan } from "../verify/plan.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const event = process.env.GITHUB_EVENT_PATH
  ? (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) as Record<string, unknown>)
  : {};
const plan = githubPlan(root, process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch", event);
mkdirSync(`${root}.artifacts/ci`, { recursive: true });
writeFileSync(`${root}.artifacts/ci/plan.json`, JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT)
  for (const [key, value] of Object.entries({
    browser: plan.browser.length > 0,
    artifacts: plan.release,
    postgres: plan.postgres,
  }))
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
console.log(JSON.stringify(plan, null, 2));
