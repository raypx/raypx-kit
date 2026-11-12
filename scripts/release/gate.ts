import { execFileSync } from "node:child_process";
export interface CiRun {
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
}
export function requireVerifiedCommit(sha: string, branch: string, runs: CiRun[] = []) {
  if (!/^[a-f0-9]{40}$/.test(sha) || branch !== "canary")
    throw new Error("Release requires a canary commit");
  if (
    !runs.some(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === branch &&
        ["push", "workflow_dispatch"].includes(run.event) &&
        run.status === "completed" &&
        run.conclusion === "success",
    )
  )
    throw new Error("Release requires successful CI for the same commit");
}
if (import.meta.main) {
  const sha = process.env.RELEASE_SHA ?? "",
    branch = process.env.RELEASE_BRANCH ?? "";
  if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== sha)
    throw new Error("Release checkout must match the verified commit");
  const runs = (
    JSON.parse(
      execFileSync(
        "gh",
        [
          "api",
          `repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=canary&per_page=100`,
        ],
        { encoding: "utf8" },
      ),
    ) as { workflow_runs: CiRun[] }
  ).workflow_runs;
  requireVerifiedCommit(sha, branch, runs);
  console.log(`Release CI verified for ${sha}`);
}
