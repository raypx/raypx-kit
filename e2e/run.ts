import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertToolchainRuntime } from "../scripts/checks/toolchain.js";
import { browserProjects, projectNames } from "./projects.js";

const root = fileURLToPath(new URL("../", import.meta.url));
assertToolchainRuntime(root);
const forwarded: string[] = [];
const requested: string[] = [];
let skipBuild = false;
const input = process.argv.slice(2);
for (let index = 0; index < input.length; index++) {
  const argument = input[index]!;
  if (argument === "--skip-build") skipBuild = true;
  else if (argument === "--project" || argument.startsWith("--project=")) {
    const name = argument === "--project" ? input[++index] : argument.slice("--project=".length);
    if (!name) throw new Error("--project requires a workspace name");
    requested.push(name);
  } else forwarded.push(argument);
}
const selected = projectNames(requested);

async function run(binary: string, args: string[], env = process.env, cwd = root): Promise<void> {
  const child = spawn(binary, args, { cwd, stdio: "inherit", env });
  const interrupt = () => child.kill("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (status) => resolve(status ?? 1));
    });
    if (code !== 0) process.exit(code);
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

if (!forwarded.includes("--list")) {
  if (!skipBuild) {
    await run(process.execPath, [
      "run",
      "build",
      ...selected.map((name) => `--filter=${browserProjects[name].workspace}`),
    ]);
  }
  // These consumers deliberately resolve built public exports. Keep their type
  // and lint checks after builds, separate from the clean-checkout source gate.
  for (const name of selected) {
    await run(process.execPath, [
      "--check",
      "--tsconfig-override",
      `${browserProjects[name].directory}/e2e/tsconfig.json`,
    ]);
  }
  await run(
    process.execPath,
    [
      `${root}node_modules/vite-plus/bin/vp`,
      "lint",
      "--config",
      `${root}e2e/vite.config.ts`,
      ...selected.map((name) => `${root}${browserProjects[name].directory}/e2e`),
    ],
    process.env,
    `${root}e2e`,
  );
}
await run(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...selected.map((name) => `--project=${name}`),
    ...forwarded,
  ],
  { ...process.env, RAYPX_E2E_PROJECTS: selected.join(",") },
);
