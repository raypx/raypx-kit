import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { githubPlan } from "../verify/plan.js";
import { runVerification } from "../verify/run.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const phase = process.argv[2];
if (phase !== "javascript" && phase !== "browser" && phase !== "artifacts")
  throw new Error("Choose javascript, browser or artifacts");
const event = process.env.GITHUB_EVENT_PATH
  ? (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) as Record<string, unknown>)
  : {};
await runVerification(
  root,
  githubPlan(root, process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch", event),
  phase,
);
