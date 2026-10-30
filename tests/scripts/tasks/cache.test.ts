import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vite-plus/test";

const repository = fileURLToPath(new URL("../../../", import.meta.url));

it("reuses real VP artifacts, invalidates dependency edits and restores deleted build outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "kit-vp-cache-"));
  const config = fileURLToPath(new URL("../../../scripts/tasks/config.ts", import.meta.url));
  const run = (args: string[], name = "@fixture/consumer#build", env: NodeJS.ProcessEnv = {}) =>
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../../../scripts/tasks/run.ts", import.meta.url)), name, ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          TOOLKIT_TASK_ROOT: root,
          TOOLKIT_VERIFY_ROOT: root,
          TOOLKIT_VERIFY_TASKS: "",
          NO_COLOR: "1",
          ...env,
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
  try {
    await mkdir(join(root, ".artifacts"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "cache-fixture",
        private: true,
        packageManager: "bun@1.4.4",
        workspaces: ["packages/*"],
      }),
    );
    for (const name of ["base", "consumer"]) {
      const directory = join(root, "packages", name);
      await mkdir(join(directory, "src"), { recursive: true });
      await writeFile(join(directory, "src/value.txt"), "first");
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
          name: `@fixture/${name}`,
          type: "module",
          scripts: { check: "bun --version", build: "bun build.mjs" },
          dependencies: name === "consumer" ? { "@fixture/base": "workspace:*" } : {},
        }),
      );
      await writeFile(
        join(directory, "build.mjs"),
        `import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"; readdirSync("../../.artifacts"); mkdirSync("dist",{recursive:true}); mkdirSync(".artifacts",{recursive:true}); appendFileSync(".artifacts/builds.txt", "run\\n"); writeFileSync("dist/args.json",JSON.stringify(process.argv.slice(2))); writeFileSync("dist/value.txt",readFileSync(${JSON.stringify(name === "base" ? "src/value.txt" : "../base/dist/value.txt")},"utf8"));`,
      );
      await writeFile(
        join(directory, "vite.config.ts"),
        `import { workspaceTaskConfig } from ${JSON.stringify(config)}; export default workspaceTaskConfig(import.meta.url, ${JSON.stringify(root)});`,
      );
    }
    await mkdir(join(root, "scripts/tasks"), { recursive: true });
    await writeFile(
      join(root, "scripts/tasks/leaf.ts"),
      `import { runTaskLeaf } from ${JSON.stringify(fileURLToPath(new URL("../../../packages/devkit/src/tasks.ts", import.meta.url)))}; process.exitCode = await runTaskLeaf({ runtime: process.execPath });`,
    );
    execFileSync(process.execPath, ["install", "--ignore-scripts"], { cwd: root, stdio: "pipe" });
    await symlink(
      join(repository, "node_modules/vite-plus"),
      join(root, "node_modules/vite-plus"),
      "dir",
    );
    await mkdir(join(root, "node_modules/.bin"), { recursive: true });
    await symlink(
      join(repository, "node_modules/vite-plus/bin/vp"),
      join(root, "node_modules/.bin/vp"),
    );
    await writeFile(
      join(root, "vite.config.ts"),
      `import { workspaceTaskConfig } from ${JSON.stringify(config)}; export default workspaceTaskConfig(import.meta.url, ${JSON.stringify(root)});`,
    );
    run([]);
    await writeFile(join(root, ".artifacts/unrelated.log"), "new CI diagnostics");
    const warm = run([]);
    expect(warm).toContain("cache hit");
    // CI verification and direct workspace builds must share the same no-argument cache.
    const gate = run([], "verify:run", {
      TOOLKIT_VERIFY_TASKS: '["@fixture/consumer#task:build"]',
    });
    expect(gate).toContain("cache hit");
    expect(await readFile(join(root, "packages/consumer/.artifacts/builds.txt"), "utf8")).toBe(
      "run\n",
    );
    // CLI arguments affect only the selected leaf, never dependency builds.
    run(["--", "--label=selected"]);
    expect(await readFile(join(root, "packages/consumer/dist/args.json"), "utf8")).toBe(
      '["--label=selected"]',
    );
    expect(await readFile(join(root, "packages/base/.artifacts/builds.txt"), "utf8")).toBe("run\n");
    expect(await readFile(join(root, "packages/consumer/.artifacts/builds.txt"), "utf8")).toBe(
      "run\nrun\n",
    );

    expect(await readFile(join(root, "packages/consumer/dist/value.txt"), "utf8")).toBe("first");
    await writeFile(join(root, "packages/base/src/value.txt"), "second");
    run([]);
    expect(await readFile(join(root, "packages/consumer/dist/value.txt"), "utf8")).toBe("second");
    await Promise.all(
      ["base", "consumer"].map((name) =>
        rm(join(root, "packages", name, "dist"), { recursive: true }),
      ),
    );
    const restored = run([]);
    expect(restored).toContain("cache hit");
    assert.equal(await readFile(join(root, "packages/consumer/dist/value.txt"), "utf8"), "second");
  } finally {
    if (process.env.TOOLKIT_KEEP_TASK_FIXTURE === "1") console.log(`Task fixture: ${root}`);
    else await rm(root, { recursive: true, force: true });
  }
}, 90_000);
