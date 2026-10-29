import { dirname, relative } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { taskModel } from "./model.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export function workspaceTaskConfig(url: string, root = repositoryRoot) {
  const canonical = realpathSync(root);
  const model = taskModel(canonical, process.env.TOOLKIT_VERIFY_TASKS);
  const path = relative(canonical, realpathSync(dirname(fileURLToPath(url)))).replaceAll("\\", "/");
  const owner = path ? model.members.find((member) => member.path === path)?.name : model.rootName;
  if (!owner) throw new Error(`No workspace owns ${path}`);
  return {
    run: {
      tasks: Object.fromEntries(
        [...model.tasks]
          .filter(([ref]) => ref.startsWith(`${owner}#`))
          .map(([ref, task]) => [ref.slice(owner.length + 1), task]),
      ),
    },
  };
}
