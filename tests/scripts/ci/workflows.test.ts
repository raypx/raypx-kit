import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYAML } from "confbox/yaml";
import { expect, it } from "vite-plus/test";
import { checkResults } from "../../../scripts/ci/result.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
interface Steps {
  steps?: { uses?: string; with?: Record<string, string>; run?: string }[];
}
interface Workflow {
  on: {
    push?: unknown;
    workflow_call?: unknown;
    workflow_run?: { workflows: string[]; branches: string[]; types: string[] };
  };
  jobs: Record<
    string,
    Steps & {
      needs?: string[] | string;
      if?: string;
      permissions?: { contents?: string };
      with?: Record<string, string>;
    }
  >;
}
const read = <T>(path: string) => parseYAML(readFileSync(join(root, path), "utf8")) as T;

function installsNode(job: Steps): boolean {
  return Boolean(
    job.steps?.some(({ uses }) => {
      if (uses?.startsWith("actions/setup-node@")) return true;
      return uses?.startsWith("./.github/actions/")
        ? installsNode(read<{ runs: Steps }>(`${uses}/action.yml`).runs)
        : false;
    }),
  );
}

it("installs Node for every default CI job, including nested setup actions", () => {
  const ci = read<Workflow>(".github/workflows/ci.yml");
  expect(
    Object.values(ci.jobs)
      .filter((job) => job.steps)
      .every(installsNode),
  ).toBe(true);
  const compatibility = read<Workflow>(".github/workflows/node-compatibility.yml");
  expect(installsNode(compatibility.jobs.prepare!)).toBe(true);
});

it("grants read access when Release calls the reusable compatibility workflow", () => {
  const release = read<Workflow>(".github/workflows/release.yml");
  expect(release.jobs.compatibility?.permissions?.contents).toBe("read");
});

it("runs the final required check after failures and covers every conditional gate", () => {
  const { jobs } = read<Workflow>(".github/workflows/ci.yml");
  expect(jobs.verify?.if).toBe("always()");
  for (const name of Object.keys(jobs).filter((name) => name !== "verify")) {
    expect(jobs.verify?.needs).toContain(name);
    const needs = Object.fromEntries(
      (jobs.verify!.needs as string[]).map((name) => [
        name,
        {
          result: "success",
          outputs: { browser: "true", artifacts: "true", postgres: "true" },
        },
      ]),
    );
    needs[name]!.result = "cancelled";
    expect(checkResults(needs), `${name} cancellation cannot pass`).toContain(`${name}: cancelled`);
  }
});

it("keeps release.yml as the publishing identity after successful canary CI", () => {
  const { jobs } = read<Workflow>(".github/workflows/ci.yml");
  expect(jobs.release).toBeUndefined();
  const release = read<Workflow>(".github/workflows/release.yml");
  expect(release.on.push).toBeUndefined();
  expect(release.on.workflow_call).toBeUndefined();
  expect(release.on).toHaveProperty("workflow_dispatch");
  expect(release.on.workflow_run).toEqual({
    workflows: ["CI"],
    branches: ["canary"],
    types: ["completed"],
  });
  expect(release.jobs.plan?.if).toContain("github.event.workflow_run.conclusion == 'success'");
  expect(release.jobs.plan?.if).toContain("github.event.workflow_run.head_branch == 'canary'");
  expect(release.jobs.plan?.if).toContain(
    "github.event.workflow_run.head_repository.full_name == github.repository",
  );
  expect(release.jobs.plan?.if).toContain(
    `contains(fromJSON('["push", "workflow_dispatch"]'), github.event.workflow_run.event)`,
  );
});

it("pins release and compatibility checkouts to the CI commit instead of the default branch tip", () => {
  const release = read<Workflow>(".github/workflows/release.yml");
  const releaseRef = "${{ github.event.workflow_run.head_sha || github.sha }}";
  for (const name of ["plan", "version", "publish"]) {
    const checkout = release.jobs[name]?.steps?.find(({ uses }) =>
      uses?.startsWith("actions/checkout@"),
    );
    expect(checkout?.with?.ref, name).toBe(releaseRef);
  }
  expect(release.jobs.compatibility?.with?.ref).toBe(releaseRef);
  const compatibility = read<Workflow>(".github/workflows/node-compatibility.yml");
  for (const job of Object.values(compatibility.jobs)) {
    const checkout = job.steps?.find(({ uses }) => uses?.startsWith("actions/checkout@"));
    expect(checkout?.with?.ref).toBe("${{ inputs.ref || github.sha }}");
  }
  for (const name of ["version", "publish"]) {
    expect(release.jobs[name]?.steps?.some(({ run }) => run === "git switch -C canary")).toBe(true);
  }
});
