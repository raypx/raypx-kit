import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { taskModel } from "../../../scripts/tasks/model.js";
import { runTasks } from "../../../scripts/tasks/run.js";
import { run } from "../../../packages/devkit/src/process.js";
import { runVerification } from "../../../scripts/verify/run.js";
import { verificationPlan } from "../../../scripts/verify/plan.js";

vi.mock("../../../scripts/tasks/run.js", () => ({ runTasks: vi.fn() }));
vi.mock("../../../packages/devkit/src/process.js", () => ({ run: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("checks exported configuration archives without inventing a build task", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const model = taskModel(root);
  const plan = verificationPlan(model, ["packages/tsconfig/base.json"]);
  await runVerification(root, plan, "artifacts");
  const selection = JSON.parse(
    vi.mocked(runTasks).mock.calls[0]![3]!.TOOLKIT_VERIFY_TASKS!,
  ) as string[];
  expect(selection).not.toContain("@raypx-kit/tsconfig#task:build");
  expect(selection.length).toBeGreaterThan(0);
  expect(selection.every((ref) => model.tasks.has(ref))).toBe(true);
  expect(
    vi
      .mocked(run)
      .mock.calls.some(
        ([, args, , env]) =>
          args[0] === "scripts/packages/check.ts" &&
          env?.TOOLKIT_PACKAGES?.includes("@raypx-kit/tsconfig"),
      ),
  ).toBe(true);
});

it("executes exactly the quick plan without browser or archive subprocesses", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const plan = verificationPlan(taskModel(root), ["packages/security/src/arcjet.ts"], {
    quick: true,
  });
  await runVerification(root, plan);
  expect(runTasks).toHaveBeenCalledOnce();
  const selection = JSON.parse(
    vi.mocked(runTasks).mock.calls[0]![3]!.TOOLKIT_VERIFY_TASKS!,
  ) as string[];
  expect(selection).toEqual(plan.tasks);
  expect(selection).toContain("@raypx-kit/security#task:test:unit");
  expect(run).not.toHaveBeenCalled();
});

it("prints the effective quick plan from the command line", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync(
    process.execPath,
    ["scripts/verify/run.ts", "--quick", "--full", "--dry-run"],
    { cwd: root, encoding: "utf8" },
  );
  const plan = JSON.parse(output) as ReturnType<typeof verificationPlan>;
  expect(plan.tasks).toContain("raypx-kit#task:lint");
  expect(plan.tasks).toContain("@raypx-kit/security#task:test:unit");
  expect(plan.tasks.some((ref) => ref.endsWith("#task:test"))).toBe(false);
  expect(plan.tasks.some((ref) => ref.endsWith("#task:build"))).toBe(false);
  expect(plan.packages).toEqual([]);
  expect(plan.browser).toEqual([]);
  expect(plan.postgres).toBe(false);
  expect(plan.release).toBe(false);
});
