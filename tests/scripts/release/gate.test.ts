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
it("accepts an explicit verified caller or successful manual CI for the exact commit", () => {
  expect(() => requireVerifiedCommit(sha, "canary", sha)).not.toThrow();
  expect(() => requireVerifiedCommit(sha, "canary", undefined, [passed])).not.toThrow();
});
it.each(["failure", "cancelled", "skipped", null])(
  "blocks a manual release whose CI result is %s",
  (conclusion) => {
    expect(() =>
      requireVerifiedCommit(sha, "canary", undefined, [{ ...passed, conclusion }]),
    ).toThrow("same commit");
  },
);
it("rejects missing results, pull requests, unverified callers and mismatched commits", () => {
  for (const runs of [
    [],
    [{ ...passed, head_sha: "b".repeat(40) }],
    [{ ...passed, event: "pull_request" }],
    [{ ...passed, status: "in_progress" }],
  ])
    expect(() => requireVerifiedCommit(sha, "canary", undefined, runs)).toThrow();
  expect(() => requireVerifiedCommit(sha, "feature", sha)).toThrow();
  expect(() => requireVerifiedCommit(sha, "canary", "b".repeat(40), [passed])).toThrow();
});
