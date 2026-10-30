import { fileURLToPath } from "node:url";
import { run } from "../../packages/devkit/src/process.js";
import { assertToolchainRuntime } from "../checks/toolchain.js";
import { taskModel, taskRef } from "../tasks/model.js";
import { runTasks } from "../tasks/run.js";
import { browserProjects, type BrowserProject } from "../../e2e/projects.js";
import { localPlan, type VerificationPlan } from "./plan.js";

export async function runVerification(
  root: string,
  plan: VerificationPlan,
  phase: "javascript" | "browser" | "artifacts" | "full" = "full",
) {
  assertToolchainRuntime(root);
  const model = taskModel(root);
  const builds = (names: string[]) =>
    names.map((name) => taskRef(name, "build")).filter((ref) => model.tasks.has(ref));
  const execute = (tasks: string[]) =>
    runTasks(root, "verify:run", [], { TOOLKIT_VERIFY_TASKS: JSON.stringify([...new Set(tasks)]) });
  if (["javascript", "full"].includes(phase)) await execute(plan.tasks);
  if (["browser", "full"].includes(phase) && plan.browser.length) {
    if (phase === "browser")
      await execute(
        builds(plan.browser.map((name) => browserProjects[name as BrowserProject].workspace)),
      );
    await run(
      process.execPath,
      ["e2e/run.ts", "--skip-build", ...plan.browser.flatMap((name) => ["--project", name])],
      root,
    );
  }
  if (["artifacts", "full"].includes(phase)) {
    if (plan.packages.length) {
      if (phase === "artifacts") await execute(builds(plan.packages));
      await run(process.execPath, ["scripts/packages/check.ts"], root, {
        ...process.env,
        TOOLKIT_PACKAGES: JSON.stringify(plan.packages),
      });
    }
    if (plan.release) await run(process.execPath, ["scripts/release/check.ts"], root);
  }
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const args = process.argv.slice(2);
  let full = false,
    dry = false,
    quick = false;
  let base: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--full") full = true;
    else if (arg === "--dry-run") dry = true;
    else if (arg === "--quick") quick = true;
    else if (arg === "--base" && args[index + 1]) base = args[++index];
    else throw new Error(`Unknown verification option: ${arg}`);
  }
  const plan = localPlan(root, { full, quick, ...(base ? { base } : {}) });
  if (dry) console.log(JSON.stringify(plan, null, 2));
  else {
    const started = performance.now();
    await runVerification(root, plan);
    console.log(
      `Verification${quick ? " (quick)" : ""} passed in ${((performance.now() - started) / 1000).toFixed(1)}s (${plan.full ? "full" : "affected"}; ${plan.workspaces.length} workspaces)`,
    );
  }
}
