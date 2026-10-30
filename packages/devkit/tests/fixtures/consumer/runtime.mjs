import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArchitecture } from "@raypx-kit/devkit/architecture";
import { checkToolchain, readBunPin } from "@raypx-kit/devkit/toolchain";
import { discover } from "@raypx-kit/devkit/workspaces";
import {
  createTaskModel,
  taskPlan,
  taskRef,
  argumentKey,
  taskArguments,
  taskCacheSnapshot,
} from "@raypx-kit/devkit/tasks";
import { affectedWorkspaces } from "@raypx-kit/devkit/verification";
import { startEnvironment } from "@raypx-kit/devkit/vite";

const root = mkdtempSync(join(tmpdir(), "devkit-consumer-"));
try {
  const directory = join(root, "packages/library");
  const marker = join(root, "config-executed");
  mkdirSync(join(directory, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "consumer-fixture", private: true, workspaces: ["packages/*"] }),
  );
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: "@fixture/library",
      type: "module",
      exports: { ".": "./dist/index.mjs" },
      devkit: { kind: "library", target: "browser" },
    }),
  );
  writeFileSync(
    join(directory, "src/index.ts"),
    'import { basename } from "node:path"; export const name = basename("library");',
  );
  writeFileSync(
    join(root, "devkit.config.ts"),
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed"); throw new Error("Configuration must not execute");`,
  );

  const metadata = {
    "packages/library": {
      kind: "library",
      target: "node",
      sourceEntries: { ".": "./src/index.ts" },
    },
  };
  const index = discover(root, { metadata });
  assert.equal(existsSync(join(directory, "dist")), false);
  assert.deepEqual(index.findings, []);
  assert.deepEqual(index.workspaces[0]?.metadata, metadata["packages/library"]);
  assert.deepEqual(checkArchitecture(index), []);

  // Supplying metadata replaces manifest policy completely, including omitted entries.
  const missing = discover(root, { metadata: {} });
  assert.equal(missing.workspaces[0]?.metadata, undefined);
  assert.ok(missing.findings.some((finding) => finding.includes("packages/library")));
  assert.ok(checkArchitecture(missing).length > 0);

  const unknown = discover(root, {
    metadata: { ...metadata, "packages/missing": metadata["packages/library"] },
  });
  assert.ok(unknown.findings.some((finding) => finding.includes("packages/missing")));
  assert.ok(checkArchitecture(unknown).length > 0);
  assert.equal(existsSync(marker), false);
  const model = createTaskModel(root, {
    member: (_, member) => member,
    define: () => ({ command: "echo fixture", dependsOn: [], cache: false }),
    aggregateCommand: "echo aggregate",
    rootTasks: () => ({ inspect: { command: "echo inspect", dependsOn: [], cache: false } }),
  });
  assert.equal(taskPlan(model, [taskRef(model.rootName, "inspect")]).length, 1);
  assert.deepEqual(
    taskArguments("consumer#test", { [argumentKey("consumer#task:test")]: '["space argument"]' }),
    ["space argument"],
  );
  assert.deepEqual(taskCacheSnapshot(join(root, "absent-cache")).artifacts, []);
  assert.equal(
    affectedWorkspaces([{ name: "fixture", dependencies: [] }], new Map([["fixture", true]]), {
      merge: () => true,
      propagate: () => true,
    }).size,
    1,
  );
  const plugin = { name: "tanstack-start-core:load-env", configResolved() {} };
  startEnvironment([plugin], () => ({}));
  plugin.configResolved({ root, mode: "production" });

  // A consumer can use Bun policy independently of the host running this contract.
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      private: true,
      workspaces: ["packages/*"],
      packageManager: "bun@1.4.3",
      devEngines: {
        packageManager: { name: "bun", version: "1.4.3", onFail: "error" },
        runtime: { name: "bun", version: "1.4.3", onFail: "error" },
      },
    }),
  );
  writeFileSync(
    join(root, "mise.toml"),
    '[settings]\nidiomatic_version_file_enable_tools = ["bun"]\n',
  );
  assert.equal(readBunPin(root), "1.4.3");
  assert.deepEqual(checkToolchain(root, { runtime: "bun" }), []);
} finally {
  rmSync(root, { recursive: true, force: true });
}

// Run the installed presets through the consumer's actual Vite+ commands.
const probe = mkdtempSync(fileURLToPath(new URL("./config-probe-", import.meta.url)));
try {
  writeFileSync(join(probe, "package.json"), '{"private":true,"type":"module"}');
  writeFileSync(
    join(probe, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noEmit: true,
      },
      include: ["src.ts"],
    }),
  );
  writeFileSync(
    join(probe, "vite.config.ts"),
    `import { defineConfig } from "vite-plus";
import { strictLint } from "@raypx-kit/devkit/lint";
export default defineConfig({ lint: strictLint });\n`,
  );
  const run = (args) =>
    execFileSync("bun", ["--bun", "vp", ...args], {
      cwd: probe,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 30_000,
    });
  writeFileSync(
    join(probe, "src.ts"),
    "export const equals = (value: string | number) => value == 1;\n",
  );
  assert.throws(
    () => run(["lint", "src.ts"]),
    (error) => {
      assert.match(`${error.stdout}\n${error.stderr}`, /eqeqeq/);
      return true;
    },
  );
  writeFileSync(
    join(probe, "src.ts"),
    "export const equals = (value: string | number) => value === 1;\n",
  );
  run(["lint", "src.ts"]);
  writeFileSync(
    join(probe, "vitest.config.ts"),
    `import { defineConfig, mergeConfig } from "vite-plus/test/config";
import { bunTestDefaults } from "@raypx-kit/devkit/testing";
export default mergeConfig(bunTestDefaults, defineConfig({ test: { include: ["fixture.test.ts"] } }));\n`,
  );
  writeFileSync(
    join(probe, "fixture.test.ts"),
    `import { expect, it } from "vite-plus/test";
import { equals } from "./src.js";
it("runs the consumer's selected suite", () => { expect(equals(1)).toBe(true); expect(equals("1")).toBe(false); });\n`,
  );
  run(["test", "--run"]);
} finally {
  rmSync(probe, { recursive: true, force: true });
}
