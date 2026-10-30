import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { taskCacheSnapshot } from "../../packages/devkit/src/tasks.js";

/** Artifact identities avoid uploading an unchanged cache because its database was touched. */
export function cacheChanged(root: string, mode: "snapshot" | "changed"): boolean {
  const directory = join(root, "node_modules/.vite/task-cache");
  mkdirSync(directory, { recursive: true });
  const files = taskCacheSnapshot(directory).artifacts;
  const before = join(root, ".artifacts/ci/vp-before.json");
  mkdirSync(join(root, ".artifacts/ci"), { recursive: true });
  if (mode === "snapshot") {
    writeFileSync(before, JSON.stringify(files));
    return false;
  }
  return taskCacheSnapshot(directory, JSON.parse(readFileSync(before, "utf8")) as string[]).changed;
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode !== "snapshot" && mode !== "changed") throw new Error("Choose snapshot or changed");
  const changed = cacheChanged(fileURLToPath(new URL("../../", import.meta.url)), mode);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  console.log(`New successful VP cache artifacts: ${changed}`);
}
