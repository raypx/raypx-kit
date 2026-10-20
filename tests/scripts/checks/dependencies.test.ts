import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkDependencyCompatibility } from "../../../scripts/checks/dependencies.js";

const fixtures: string[] = [];

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value));
}

function packageMetadata(
  root: string,
  name: string,
  version: string,
  extra: Record<string, unknown> = {},
) {
  const directory = join(root, "node_modules", name);
  mkdirSync(directory, { recursive: true });
  writeJson(join(directory, "package.json"), {
    name,
    version,
    exports: { "./package.json": "./package.json" },
    ...extra,
  });
  return directory;
}

function vitePlus(root: string, version = "1.2.0") {
  const directory = packageMetadata(root, "vite-plus", version, {
    exports: { "./package.json": "./package.json", "./versions": "./versions.cjs" },
  });
  // The real Vite version differs from the alias package's release version.
  writeFileSync(
    join(directory, "versions.cjs"),
    'exports.versions = { vite: "99.0.0", vitest: "2.3.0" };',
  );
}

function repository() {
  const root = mkdtempSync(join(tmpdir(), "raypx-kit-dependencies-"));
  fixtures.push(root);
  mkdirSync(join(root, "docs"));
  mkdirSync(join(root, "packages/library"), { recursive: true });
  writeJson(join(root, "package.json"), {
    name: "dependency-contract",
    private: true,
    workspaces: ["docs", "packages/*"],
    devDependencies: { "vite-plus": "^1.2.0" },
    overrides: { vite: "npm:@voidzero-dev/vite-plus-core@^1.2.0" },
  });
  writeJson(join(root, "docs/package.json"), {
    name: "docs",
    private: true,
    dependencies: { "@fumadocs/base-ui": "^3.4.0", "fumadocs-core": "^3.4.0" },
    devDependencies: {
      "vite-plus": "^1.2.0",
      vite: "npm:@voidzero-dev/vite-plus-core@^1.2.0",
    },
  });
  writeJson(join(root, "packages/library/package.json"), {
    name: "@raypx-kit/library",
    devDependencies: { "@vitest/coverage-v8": "^2.3.0" },
  });
  vitePlus(root);
  packageMetadata(root, "vite", "1.2.0", { name: "@voidzero-dev/vite-plus-core" });
  packageMetadata(root, "vitest", "2.3.0");
  packageMetadata(root, "@vitest/coverage-v8", "2.3.0", {
    peerDependencies: { vitest: "2.3.0" },
  });
  packageMetadata(root, "@fumadocs/base-ui", "3.4.0", {
    peerDependencies: { "fumadocs-core": "3.4.0" },
  });
  packageMetadata(root, "fumadocs-core", "3.4.0");
  return root;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("installed dependency compatibility", () => {
  it("accepts coordinated packages resolved through their public metadata exports", () => {
    expect(checkDependencyCompatibility(repository())).toEqual([]);
  });

  it("rejects a Vite+ core alias from a different release even within the declared range", () => {
    const root = repository();
    packageMetadata(root, "vite", "1.2.1", { name: "@voidzero-dev/vite-plus-core" });
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Vite+ core is 1.2.1, expected Vite+ release 1.2.0"),
      ]),
    );
  });

  it("rejects a different Vite+ release in the documentation workspace", () => {
    const root = repository();
    vitePlus(join(root, "docs"), "1.3.0");
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("docs/package.json: Vite+ is 1.3.0, expected root Vite+ 1.2.0"),
      ]),
    );
  });

  it("rejects an installed Vitest that differs from Vite+'s public bundled version", () => {
    const root = repository();
    packageMetadata(root, "vitest", "2.3.1");
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("installed Vitest is 2.3.1, expected bundled Vitest 2.3.0"),
      ]),
    );
  });

  it("rejects coverage drift that a caret range permits", () => {
    const root = repository();
    packageMetadata(root, "@vitest/coverage-v8", "2.4.0", {
      peerDependencies: { vitest: "2.4.0" },
    });
    const findings = checkDependencyCompatibility(root);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "packages/library/package.json: coverage-v8 is 2.4.0, expected bundled Vitest 2.3.0",
        ),
        expect.stringContaining("Update compatible dependencies together in bun.lock"),
      ]),
    );
  });

  it("checks the coverage provider's actual peer requirement", () => {
    const root = repository();
    packageMetadata(root, "@vitest/coverage-v8", "2.3.0", {
      peerDependencies: { vitest: "^3.0.0" },
    });
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("coverage-v8 peer: installed vitest@2.3.0 does not satisfy ^3.0.0"),
      ]),
    );
  });

  it("rejects Fumadocs UI/core drift despite compatible manifest ranges", () => {
    const root = repository();
    packageMetadata(root, "fumadocs-core", "3.4.1");
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Fumadocs Base UI is 3.4.0, but core is 3.4.1"),
      ]),
    );
  });

  it("checks the Base UI package's actual core peer requirement", () => {
    const root = repository();
    packageMetadata(root, "@fumadocs/base-ui", "3.4.0", {
      peerDependencies: { "fumadocs-core": "^4.0.0" },
    });
    expect(checkDependencyCompatibility(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "@fumadocs/base-ui peer: installed fumadocs-core@3.4.0 does not satisfy ^4.0.0",
        ),
      ]),
    );
  });
});
