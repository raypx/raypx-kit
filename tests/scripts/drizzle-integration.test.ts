import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = new URL("../../", import.meta.url);
const drizzle = fileURLToPath(new URL("packages/drizzle/", root));
const vp = fileURLToPath(new URL("node_modules/vite-plus/bin/vp", root));

function runTests(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ["--bun", vp, "test", ...args], {
    cwd: drizzle,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      CI: "true",
      GITHUB_ACTIONS: "",
      DRIZZLE_TEST_DATABASE_URL: "",
      NO_COLOR: "1",
      ...env,
    },
  });
}

describe("Drizzle database test boundary", () => {
  it("keeps database tests out of the default suite even in a CI environment", () => {
    const result = runTests(["list", "--filesOnly", "--json", "--config", "vitest.config.ts"], {
      GITHUB_ACTIONS: "true",
      DRIZZLE_TEST_DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("columns.test.ts");
    expect(result.stdout).toContain("postgres/json.test.ts");
    expect(result.stdout).not.toContain(".integration.test.ts");
  });

  it("rejects database test execution outside GitHub Actions before opening a connection", () => {
    const result = runTests(["--run", "--config", "vitest.integration.config.ts"], {
      DRIZZLE_TEST_DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Drizzle integration tests run only in GitHub Actions.",
    );
  });

  it("requires a dedicated test URL rather than falling back to DATABASE_URL", () => {
    const result = runTests(["--run", "--config", "vitest.integration.config.ts"], {
      GITHUB_ACTIONS: "true",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "DRIZZLE_TEST_DATABASE_URL is required for Drizzle integration tests.",
    );
  });

  it("fails when an integration command selects no tests", () => {
    const result = runTests(
      ["--run", "--config", "vitest.integration.config.ts", "__no_integration_matches__"],
      {
        GITHUB_ACTIONS: "true",
        DRIZZLE_TEST_DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("No test files found");
  });
});
