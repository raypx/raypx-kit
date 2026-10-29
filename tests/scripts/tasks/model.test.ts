import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { argumentKey, taskModel, taskPlan, taskRef } from "../../../scripts/tasks/model.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(cyclic = false) {
  const root = mkdtempSync(join(tmpdir(), "kit-task-model-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", packageManager: "bun@1.4.4", workspaces: ["packages/*"] }),
  );
  for (const name of ["base", "consumer"]) {
    const directory = join(root, "packages", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: `@fixture/${name}`,
        scripts: {
          check: "bun --version",
          test: "bun --version",
          build: "bun --version",
          dev: "bun --version",
        },
        dependencies:
          name === "consumer"
            ? { "@fixture/base": "workspace:*" }
            : cyclic
              ? { "@fixture/consumer": "workspace:*" }
              : {},
      }),
    );
  }
  return root;
}

it("builds dependency archives and own declarations before a consumer build", () => {
  const plan = taskPlan(taskModel(fixture()), [taskRef("@fixture/consumer", "build")]);
  const refs = plan.map(({ ref }) => ref);
  expect(refs.indexOf(taskRef("@fixture/base", "build"))).toBeLessThan(
    refs.indexOf(taskRef("@fixture/consumer", "build")),
  );
  expect(refs.indexOf(taskRef("@fixture/consumer", "check"))).toBeLessThan(
    refs.indexOf(taskRef("@fixture/consumer", "build")),
  );
});

it("deduplicates shared prerequisites across root tests and builds", () => {
  const plan = taskPlan(taskModel(fixture()), [taskRef("fixture", "test:build")]);
  expect(plan.filter(({ ref }) => ref === taskRef("@fixture/base", "build"))).toHaveLength(1);
  expect(plan.some(({ ref }) => ref === taskRef("fixture", "test:toolchain"))).toBe(true);
});

it("fingerprints dependency sources and task arguments without leaking args into prerequisite keys", () => {
  const model = taskModel(fixture());
  const task = model.tasks.get(taskRef("@fixture/consumer", "test"))!;
  expect(task.cache).not.toBe(false);
  if (!task.cache) throw new Error("Expected a cached test");
  expect(task.cache.input).toContainEqual({ pattern: "packages/base/src/**", base: "workspace" });
  expect(task.cache.env).toContain(argumentKey(taskRef("@fixture/consumer", "test")));
  expect(task.cache.env).not.toContain(argumentKey(taskRef("@fixture/base", "build")));
  expect(task.cache.output).toContain(".artifacts/junit.xml");
});

it("keeps dev servers and nested maintenance test runners outside filesystem tracing", () => {
  const model = taskModel(fixture());
  expect(model.tasks.get(taskRef("@fixture/base", "dev"))?.cache).toBe(false);
  expect(model.tasks.get(taskRef("fixture", "test:toolchain"))?.cache).toBe(false);
});

it("rejects unknown selections and cycles rather than silently running nothing", () => {
  expect(() => taskModel(fixture(), '["missing#task:build"]')).toThrow(
    "Invalid verification task selection",
  );
  expect(() => taskPlan(taskModel(fixture(true)), [taskRef("@fixture/base", "build")])).toThrow(
    "Cyclic VP task dependency",
  );
});
