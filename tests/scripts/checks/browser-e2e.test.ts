import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { browserProjects } from "../../../e2e/projects.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("every React or JSX workspace has a package-owned browser project and runnable scenarios", async () => {
  const packages = await readdir(join(root, "packages"), { withFileTypes: true });
  const workspaces = [
    "docs",
    ...packages.filter((entry) => entry.isDirectory()).map((entry) => `packages/${entry.name}`),
  ];
  const reactWorkspaces: string[] = [];
  for (const directory of workspaces) {
    const manifest = JSON.parse(await readFile(join(root, directory, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    };
    const source = join(root, directory, "src");
    const hasJsx =
      existsSync(source) &&
      (await readdir(source, { recursive: true })).some((file) => /\.[jt]sx$/.test(file));
    if (!dependencies.react && !hasJsx) continue;
    reactWorkspaces.push(directory);
    expect(manifest.scripts?.["test:e2e"], `${directory} needs its own browser command`).toContain(
      "--project",
    );
    const tests = await readdir(join(root, directory, "e2e"));
    expect(
      tests.some((file) => file.endsWith(".spec.ts")),
      `${directory} needs real browser scenarios`,
    ).toBe(true);
  }
  expect(
    Object.values(browserProjects)
      .map((project) => project.directory)
      .sort(),
  ).toEqual(reactWorkspaces.sort());
});
