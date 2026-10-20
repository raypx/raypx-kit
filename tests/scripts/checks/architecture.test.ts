import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { Metadata } from "../../../packages/devkit/src/workspaces.js";
import { checkRepositoryArchitecture } from "../../../scripts/checks/architecture.js";

const roots: string[] = [];
const metadata = {
  "packages/library": {
    kind: "library",
    target: "universal",
    sourceEntries: { ".": "./src/index.ts" },
  },
} satisfies Readonly<Record<string, Metadata>>;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "raypx-kit-architecture-"));
  roots.push(root);
  mkdirSync(join(root, "packages/library/src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
  writeFileSync(
    join(root, "packages/library/package.json"),
    JSON.stringify({
      name: "@raypx-kit/library",
      type: "module",
      exports: { ".": { types: "./dist/index.d.mts", import: "./dist/index.mjs" } },
    }),
  );
  writeFileSync(join(root, "packages/library/src/index.ts"), "export const value = 1;");
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("repository architecture gate", () => {
  it("checks the repository's maintained sources and explicit platform boundaries", () => {
    expect(
      checkRepositoryArchitecture(fileURLToPath(new URL("../../../", import.meta.url))),
    ).toEqual([]);
  });

  it("runs before building a published library", () => {
    expect(checkRepositoryArchitecture(fixture(), metadata)).toEqual([]);
  });

  it("requires generated exports to name maintained source entries", () => {
    const root = fixture();
    writeFileSync(
      join(root, "packages/library/package.json"),
      JSON.stringify({
        name: "@raypx-kit/library",
        type: "module",
        exports: { ".": "./dist/index.mjs" },
      }),
    );
    mkdirSync(join(root, "packages/library/dist"));
    writeFileSync(join(root, "packages/library/dist/index.mjs"), "export const old = true;");
    expect(
      checkRepositoryArchitecture(root, {
        "packages/library": { kind: "library", target: "universal" },
      }),
    ).toEqual(["packages/library: generated export . needs an explicit sourceEntries mapping"]);
  });

  it("catches internal source imports and host leaks in the source even when dist is safe", () => {
    const root = fixture();
    mkdirSync(join(root, "packages/library/dist"));
    writeFileSync(join(root, "packages/library/dist/index.mjs"), "export const old = true;");
    writeFileSync(
      join(root, "packages/library/src/index.ts"),
      'import "node:fs"; import "../../internal/src/index.js";',
    );
    mkdirSync(join(root, "packages/internal/src"), { recursive: true });
    writeFileSync(join(root, "packages/internal/src/index.ts"), "export const secret = 1;");
    writeFileSync(
      join(root, "packages/internal/package.json"),
      JSON.stringify({
        name: "@raypx-kit/internal",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
    );
    const findings = checkRepositoryArchitecture(root, {
      ...metadata,
      "packages/internal": { kind: "library", target: "universal" },
    }).join("\n");
    expect(findings).toContain("universal code cannot import node:fs");
    expect(findings).toContain("internal cross-workspace import ../../internal/src/index.js");
    expect(findings).toContain("undeclared runtime dependency ../../internal/src/index.js");
  });

  it("keeps repository policy out of published package manifests", () => {
    const root = fixture();
    writeFileSync(
      join(root, "packages/library/package.json"),
      JSON.stringify({
        name: "@raypx-kit/library",
        type: "module",
        exports: { ".": "./dist/index.mjs" },
        devkit: metadata["packages/library"],
      }),
    );
    expect(checkRepositoryArchitecture(root, metadata)).toEqual([
      "packages/library/package.json: keep devkit metadata only in devkit.config.ts",
    ]);
  });
});
