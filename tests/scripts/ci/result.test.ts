import { expect, it } from "vite-plus/test";
import { checkResults } from "../../../scripts/ci/result.js";

const passed = () => ({
  plan: { result: "success", outputs: { browser: "false", artifacts: "false", postgres: "false" } },
  javascript: { result: "success" },
  browser: { result: "skipped" },
  artifacts: { result: "skipped" },
  postgres: { result: "skipped" },
});

it("accepts intentional skips only for unselected gates", () => {
  expect(checkResults(passed())).toEqual([]);
});
it.each(["skipped", "failure", "cancelled"])(
  "fails a required source gate whose result is %s",
  (result) => {
    expect(checkResults({ ...passed(), javascript: { result } })).toEqual([
      `javascript: ${result}`,
    ]);
  },
);
it("rejects missing results and selected browser skips", () => {
  expect(checkResults({})).toContain("plan: missing");
  const needs = passed();
  needs.plan.outputs.browser = "true";
  expect(checkResults(needs)).toEqual(["browser: skipped"]);
});

it("rejects successful plans with missing selection outputs", () => {
  expect(checkResults({ ...passed(), plan: { result: "success" } })).toContain(
    "plan: invalid browser selection",
  );
});
