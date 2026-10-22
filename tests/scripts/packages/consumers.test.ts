import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { checkConsumer, type Manifest } from "../../../scripts/packages/consumers.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("resolves CSS exports and transitive dependencies from the same packed batch", async () => {
  const root = await mkdtemp(join(tmpdir(), "toolkit-archive-consumer-"));
  roots.push(root);
  const theme: Manifest = {
    name: "@raypx-kit-test/theme",
    version: "1.0.0",
    exports: { "./styles.css": "./styles.css" },
  };
  const ui: Manifest = {
    name: "@raypx-kit-test/ui",
    version: "1.0.0",
    exports: { "./styles.css": "./styles.css" },
    dependencies: { [theme.name]: theme.version },
  };
  const nodeBinary =
    process.env.TOOLKIT_NODE_BINARY ??
    execFileSync("node", ["-p", "process.execPath"], { encoding: "utf8" }).trim();
  const packageArchives: Record<string, string> = {};
  for (const packed of [theme, ui]) {
    const directory = join(root, packed.name.split("/").at(-1)!);
    await mkdir(directory);
    await writeFile(join(directory, "package.json"), JSON.stringify(packed));
    await writeFile(join(directory, "styles.css"), ":root { --fixture: packed; }");
    const archive = join(root, `${packed.name.split("/").at(-1)}.tgz`);
    execFileSync(process.execPath, ["pm", "pack", "--filename", archive], {
      cwd: directory,
      stdio: "pipe",
    });
    packageArchives[packed.name] = archive;
    // Consumers must resolve archived styles; the original package source is gone.
    await rm(join(directory, "styles.css"));
  }
  const packageDirectory = join(root, "ui");
  const fixture = join(packageDirectory, "tests/fixtures/consumer");
  await mkdir(fixture, { recursive: true });
  await writeFile(
    join(fixture, "runtime.mjs"),
    `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ui = require.resolve("@raypx-kit-test/ui/styles.css");
const fromUi = createRequire(ui);
assert.match(await readFile(fromUi.resolve("@raypx-kit-test/theme/styles.css"), "utf8"), /--fixture: packed/);
`,
  );
  const consumer = join(root, "consumer");
  await checkConsumer(packageArchives[ui.name]!, ui, consumer, packageDirectory, {
    bunBinary: process.execPath,
    nodeBinary,
    compilerDependencies: {},
    packageArchives,
  });
  const installed = JSON.parse(await readFile(join(consumer, "package.json"), "utf8"));
  expect(installed.overrides).toEqual(packageArchives);
  expect(await readFile(join(consumer, "exports.mjs"), "utf8")).toContain(
    "Empty stylesheet export",
  );
  // The CSS check verifies contents, not only that Node can resolve an export.
  await writeFile(join(consumer, "node_modules/@raypx-kit-test/ui/styles.css"), "\n");
  expect(() =>
    execFileSync(nodeBinary, ["exports.mjs"], { cwd: consumer, stdio: "pipe" }),
  ).toThrow();
}, 30_000);
