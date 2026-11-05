import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { assertNodePnpmRuntime, checkToolchain, readNodePnpmPins } from "../src/toolchain.js";
import { nodeTestDefaults } from "../src/testing.js";

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync }));

const roots: string[] = [];
afterEach(() => {
  execFileSync.mockReset();
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function repository(node = "24.22.2") {
  const root = mkdtempSync(join(tmpdir(), "devkit-node-pnpm-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      packageManager: "pnpm@12.16.1",
      engines: { node },
      devEngines: {
        runtime: { name: "node", version: node, onFail: "error" },
        packageManager: { name: "pnpm", version: "12.16.1", onFail: "error" },
      },
    }),
  );
  writeFileSync(
    join(root, "mise.toml"),
    '[settings]\nidiomatic_version_file_enable_tools = ["node"]\n',
  );
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  writeFileSync(
    join(root, ".github/workflows/ci.yml"),
    `jobs:
  test:
    steps:
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with: { node-version-file: package.json }
`,
  );
  return root;
}
it("reads manifest pins without requiring Bun or a second Node pin", () => {
  const root = repository();
  expect(readNodePnpmPins(root)).toEqual({ node: "24.22.2", pnpm: "12.16.1" });
  expect(checkToolchain(root, { runtime: "node-pnpm" })).toEqual([]);
  expect(nodeTestDefaults.test).not.toHaveProperty("execArgv");
});
it("rejects duplicate runtime pins and CI drift", () => {
  const root = repository();
  writeFileSync(join(root, ".nvmrc"), "24.22.0");
  writeFileSync(
    join(root, ".github/workflows/ci.yml"),
    `jobs:
  test:
    steps:
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v7
        with: { node-version: 24.22.2 }
      - uses: pnpm/action-setup@v6
        with: { version: 12.16.1 }
`,
  );
  expect(checkToolchain(root, { runtime: "node-pnpm" })).toEqual(
    expect.arrayContaining([
      ".nvmrc: use the root Node/pnpm pins only",
      ".github/workflows/ci.yml: use the Node/pnpm toolchain",
      ".github/workflows/ci.yml: setup-node must read package.json",
      ".github/workflows/ci.yml: pnpm setup must read packageManager",
    ]),
  );
});

it("checks the actual pnpm executable in the selected Node runtime", () => {
  const root = repository(process.versions.node);
  execFileSync.mockReturnValue("12.16.1\n");
  expect(assertNodePnpmRuntime(root)).toEqual({ node: process.versions.node, pnpm: "12.16.1" });
  expect(execFileSync).toHaveBeenCalledWith("pnpm", ["--version"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
});

it("rejects a mismatched Node before running pnpm", () => {
  expect(() => assertNodePnpmRuntime(repository("99.0.0"))).toThrow("Expected Node 99.0.0");
  expect(execFileSync).not.toHaveBeenCalled();
});

it("rejects a mismatched pnpm version", () => {
  execFileSync.mockReturnValue("12.15.0\n");
  expect(() => assertNodePnpmRuntime(repository(process.versions.node))).toThrow(
    "Expected pnpm 12.16.1, got 12.15.0",
  );
});
