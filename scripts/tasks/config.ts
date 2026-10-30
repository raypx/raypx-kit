import { fileURLToPath } from "node:url";
import { taskConfig, taskSelection } from "../../packages/devkit/src/tasks.js";
import { taskModel } from "./model.js";
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export function workspaceTaskConfig(url: string, root = repositoryRoot) {
  return taskConfig(
    taskModel(root, taskSelection(root, "TOOLKIT_VERIFY_TASKS", "TOOLKIT_VERIFY_ROOT")),
    url,
  );
}
