import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../../packages/devkit/src/process.js";
import { argumentKey, taskModel, taskPlan, taskRef } from "./model.js";
import { taskEnvironment } from "./environment.js";

export async function runTasks(
  root: string,
  name: string,
  args: string[] = [],
  environment: NodeJS.ProcessEnv = {},
) {
  const model = taskModel(
    root,
    environment.TOOLKIT_VERIFY_TASKS ?? process.env.TOOLKIT_VERIFY_TASKS,
  );
  const separator = name.lastIndexOf("#");
  const owner = separator < 0 ? model.rootName : name.slice(0, separator);
  const task = separator < 0 ? name : name.slice(separator + 1);
  const filtered = args.some((arg) => arg === "--filter" || arg.startsWith("--filter="));
  if (separator >= 0 && filtered) throw new Error("Choose a qualified task or workspace filters");
  if (args.includes("--dry-run") || args.includes("--dry=json")) {
    if (filtered) throw new Error("Choose a qualified task when inspecting a filtered plan");
    console.log(JSON.stringify(taskPlan(model, [taskRef(owner, task)]), null, 2));
    return;
  }
  for (const member of model.members)
    for (const directory of ["dist", ".output", ".artifacts"])
      mkdirSync(join(root, member.path, directory), { recursive: true });
  const split = args.indexOf("--");
  const forwarded = split < 0 ? [] : args.slice(split + 1);
  const options = (split < 0 ? args : args.slice(0, split)).map((arg) =>
    arg === "--summarize" ? "--verbose" : arg.replace(/^--concurrency=/, "--concurrency-limit="),
  );
  const taskArguments = forwarded.length
    ? Object.fromEntries(
        model.members
          .filter((member) => (separator < 0 || member.name === owner) && member.scripts[task])
          .map((member) => [argumentKey(taskRef(member.name, task)), JSON.stringify(forwarded)]),
      )
    : {};
  await run(
    process.execPath,
    [
      "--bun",
      "vp",
      "run",
      "--fail-if-no-match",
      "--log",
      "labeled",
      ...options,
      filtered ? `task:${task}` : taskRef(owner, task),
    ],
    root,
    taskEnvironment({
      ...process.env,
      ...environment,
      ...taskArguments,
      VP_RUN_CONCURRENCY_LIMIT: process.env.VP_RUN_CONCURRENCY_LIMIT ?? "2",
    }),
  );
}

if (import.meta.main) {
  const [name, ...args] = process.argv.slice(2);
  if (!name) throw new Error("Expected a VP task");
  await runTasks(
    process.env.TOOLKIT_TASK_ROOT ?? fileURLToPath(new URL("../../", import.meta.url)),
    name,
    args,
  );
}
