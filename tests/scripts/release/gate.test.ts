import { expect, it } from "vite-plus/test";
import { requireVerifiedCommit, type CiRun } from "../../../scripts/release/gate.js";
const sha = "a".repeat(40);
const passed: CiRun = {
  head_sha: sha,
  head_branch: "canary",
  event: "push",
  status: "completed",
  conclusion: "success",
};
it.each(["push", "workflow_dispatch"])("accepts successful %s CI for the exact commit", (event) => {
  expect(() => requireVerifiedCommit(sha, "canary", [{ ...passed, event }])).not.toThrow();
});
it.each(["failure", "cancelled", "skipped", null])(
  "blocks a release whose CI result is %s",
  (conclusion) => {
    expect(() => requireVerifiedCommit(sha, "canary", [{ ...passed, conclusion }])).toThrow(
      "same commit",
    );
  },
);
it("rejects missing results, pull requests, other branches and mismatched commits", () => {
  for (const runs of [
    [],
    [{ ...passed, head_sha: "b".repeat(40) }],
    [{ ...passed, event: "pull_request" }],
    [{ ...passed, head_branch: "feature" }],
    [{ ...passed, status: "in_progress" }],
  ])
    expect(() => requireVerifiedCommit(sha, "canary", runs)).toThrow();
  expect(() => requireVerifiedCommit(sha, "feature", [passed])).toThrow();
  expect(() => requireVerifiedCommit("invalid", "canary", [passed])).toThrow();
});
