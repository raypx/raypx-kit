import { fileURLToPath } from "node:url";
import { runTasks as execute, taskSelection } from "../../packages/devkit/src/tasks.js";
import { taskModel } from "./model.js";
export async function runTasks(
  root: string,
  name: string,
  args: string[] = [],
  environment: NodeJS.ProcessEnv = {},
) {
  const selection =
    environment.TOOLKIT_VERIFY_TASKS ??
    taskSelection(root, "TOOLKIT_VERIFY_TASKS", "TOOLKIT_VERIFY_ROOT");
  await execute(taskModel(root, selection), name, args, {
    runtime: process.execPath,
    environment: { ...environment, ...(selection ? { TOOLKIT_VERIFY_ROOT: root } : {}) },
    allowFilteredArguments: true,
  });
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
