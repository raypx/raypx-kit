import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { taskModel } from "../../../scripts/tasks/model.js";
import { changedFiles, verificationPlan } from "../../../scripts/verify/plan.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function model() {
  const root = mkdtempSync(join(tmpdir(), "kit-verification-plan-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      packageManager: "bun@1.4.4",
      workspaces: ["packages/*", "docs"],
    }),
  );
  for (const name of ["themes", "ui", "email-preview", "storage", "drizzle", "docs"]) {
    const path = name === "docs" ? name : `packages/${name}`;
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(
      join(root, path, "package.json"),
      JSON.stringify({
        name: name === "docs" ? name : `@raypx-kit/${name}`,
        private: name === "docs" || name === "ui",
        scripts: { check: "bun --version", test: "bun --version", build: "bun --version" },
        devDependencies:
          name === "ui" || name === "docs"
            ? { "@raypx-kit/themes": "workspace:*" }
            : name === "email-preview"
              ? { "@raypx-kit/ui": "workspace:*" }
              : {},
      }),
    );
  }
  return taskModel(root);
}

it("keeps documentation-only edits out of unrelated libraries and PostgreSQL", () => {
  const plan = verificationPlan(model(), ["docs/architecture/README.md"]);
  expect(plan.full).toBe(false);
  expect(plan.workspaces).toEqual(["docs"]);
  expect(plan.browser).toEqual(["docs"]);
  expect(plan.packages).toEqual([]);
  expect(plan.postgres).toBe(false);
});

it("reaches bundled development dependencies and every affected browser consumer", () => {
  const plan = verificationPlan(model(), ["packages/themes/src/index.ts"]);
  expect(plan.workspaces).toEqual([
    "@raypx-kit/email-preview",
    "@raypx-kit/themes",
    "@raypx-kit/ui",
    "docs",
  ]);
  expect(plan.browser.sort()).toEqual(["docs", "email-preview", "themes", "ui"]);
  expect(plan.packages).toEqual(["@raypx-kit/email-preview", "@raypx-kit/themes"]);
  expect(plan.postgres).toBe(false);
});

it("checks published README payloads while skipping unrelated library tests", () => {
  const plan = verificationPlan(model(), ["packages/storage/README.md"]);
  expect(plan.workspaces).toEqual(["docs"]);
  expect(plan.packages).toEqual(["@raypx-kit/storage"]);
  expect(plan.tasks).toContain("@raypx-kit/storage#task:build");
  expect(plan.tasks).not.toContain("@raypx-kit/storage#task:test");
});

it("requires PostgreSQL for Drizzle changes", () => {
  expect(verificationPlan(model(), ["packages/drizzle/src/postgres.ts"]).postgres).toBe(true);
});

it.each([
  "bun.lock",
  "scripts/tasks/model.ts",
  "packages/devkit/src/workspaces.ts",
  "packages/tsconfig/base.json",
  "unknown-source.ts",
])("falls back to all gates for shared or unclassified input %s", (file) => {
  const plan = verificationPlan(model(), [file]);
  expect(plan.full).toBe(true);
  expect(plan.postgres).toBe(true);
  expect(plan.browser.length).toBeGreaterThan(1);
});

it("treats an unavailable Git base as full coverage", () => {
  const current = model();
  const changed = changedFiles(current.root, "missing-base");
  expect(verificationPlan(current, changed.files, { reasons: changed.reasons }).full).toBe(true);
});
