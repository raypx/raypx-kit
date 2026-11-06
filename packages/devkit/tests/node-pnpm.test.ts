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
  vi.unstubAllGlobals();
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
it("accepts a Node range while keeping the pnpm version exact", () => {
  const root = repository("^22.22.2 || ^24.18.0 || >=26.0.0");
  writeFileSync(
    join(root, "README.md"),
    "Develop with Node **^22.22.2 || ^24.18.0 || >=26.0.0** and pnpm **12.16.1**.\n",
  );
  expect(readNodePnpmPins(root)).toEqual({
    node: "^22.22.2 || ^24.18.0 || >=26.0.0",
    pnpm: "12.16.1",
  });
  expect(checkToolchain(root, { runtime: "node-pnpm" })).toEqual([]);
});

it.each(["22.22.2", "22.23.0", "24.18.0", "24.22.2", "26.0.0", "26.12.0", "27.0.0"])(
  "accepts Node %s across the supported major ranges",
  (node) => {
    vi.stubGlobal("process", { versions: { node } });
    execFileSync.mockReturnValue("12.16.1\n");
    expect(assertNodePnpmRuntime(repository("^22.22.2 || ^24.18.0 || >=26.0.0"))).toEqual({
      node,
      pnpm: "12.16.1",
    });
  },
);

it.each(["20.19.0", "22.22.1", "23.0.0", "24.17.9", "25.0.0", "26.0.0-rc.1"])(
  "rejects Node %s outside the supported major ranges",
  (node) => {
    vi.stubGlobal("process", { versions: { node } });
    expect(() => assertNodePnpmRuntime(repository("^22.22.2 || ^24.18.0 || >=26.0.0"))).toThrow(
      `Expected Node ^22.22.2 || ^24.18.0 || >=26.0.0, got ${node}`,
    );
    expect(execFileSync).not.toHaveBeenCalled();
  },
);

it.each(["", "not-a-version", ">=24.invalid"])("rejects an invalid Node requirement %j", (node) => {
  expect(() => readNodePnpmPins(repository(node))).toThrow("valid Node version or range");
});

it("reports a documented Node range that differs from the manifest", () => {
  const root = repository(">=24.18.0 <25");
  writeFileSync(join(root, "README.md"), "Develop with Node **>=22.22.2 <25**.\n");
  expect(checkToolchain(root, { runtime: "node-pnpm" })).toContain(
    "README.md: documented Node pin differs from package.json",
  );
});

it.each(["24.18.0", "24.22.1", "24.99.0"])("accepts supported Node %s", (node) => {
  vi.stubGlobal("process", { versions: { node } });
  execFileSync.mockReturnValue("12.16.1\n");
  expect(assertNodePnpmRuntime(repository(">=24.18.0 <25"))).toEqual({
    node,
    pnpm: "12.16.1",
  });
});

it.each(["22.22.2", "24.17.9", "25.0.0", "25.0.0-rc.1"])("rejects unsupported Node %s", (node) => {
  vi.stubGlobal("process", { versions: { node } });
  expect(() => assertNodePnpmRuntime(repository(">=24.18.0 <25"))).toThrow(
    `Expected Node >=24.18.0 <25, got ${node}`,
  );
  expect(execFileSync).not.toHaveBeenCalled();
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
