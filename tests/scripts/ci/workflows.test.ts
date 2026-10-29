import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYAML } from "confbox/yaml";
import { expect, it } from "vite-plus/test";
import { checkResults } from "../../../scripts/ci/result.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
interface Steps {
  steps?: { uses?: string }[];
}
interface Workflow {
  jobs: Record<
    string,
    Steps & { needs?: string[]; if?: string; permissions?: { contents?: string } }
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

it("keeps Node installation outside every default CI job, including nested setup actions", () => {
  const ci = read<Workflow>(".github/workflows/ci.yml");
  expect(Object.values(ci.jobs).some(installsNode)).toBe(false);
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
      jobs.verify!.needs!.map((name) => [
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
