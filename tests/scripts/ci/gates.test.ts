import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vite-plus/test";
import { taskModel } from "../../../scripts/tasks/model.js";
import { runTasks } from "../../../scripts/tasks/run.js";
import { run } from "../../../packages/devkit/src/process.js";
import { runVerification } from "../../../scripts/verify/run.js";
import { verificationPlan } from "../../../scripts/verify/plan.js";

vi.mock("../../../scripts/tasks/run.js", () => ({ runTasks: vi.fn() }));
vi.mock("../../../packages/devkit/src/process.js", () => ({ run: vi.fn() }));

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
