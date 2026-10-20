import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { redactDiagnostics } from "../../../scripts/ci/diagnostics.js";
import { workspaceTests } from "../../../tests/config.js";

const script = fileURLToPath(new URL("../../../scripts/ci/diagnostics.ts", import.meta.url));
const directories: string[] = [];

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "raypx-ci-diagnostics-"));
  directories.push(directory);
  return directory;
}

function run(directory: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      RAYPX_CI_DIAGNOSTICS_DIRECTORY: join(directory, ".artifacts/ci"),
      GITHUB_STEP_SUMMARY: join(directory, "step-summary.md"),
      ...env,
    },
  });
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("CI diagnostic commands", () => {
  it("preserves failure status and redacts secrets spanning child output chunks", () => {
    const directory = repository();
    const result = run(
      directory,
      [
        "run",
        "tests",
        process.execPath,
        "-e",
        'process.stdout.write(process.env.CI_TEST_TOKEN.slice(0, 3)); setTimeout(() => { console.log(process.env.CI_TEST_TOKEN.slice(3)); console.error("test failed"); process.exitCode = 7; }, 10)',
      ],
      { CI_TEST_TOKEN: "fixture-sensitive-value" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(7);
    expect(result.stdout).toContain("[REDACTED]");
    expect(result.stderr).toContain("test failed");
    const artifacts = join(directory, ".artifacts/ci/diagnostics");
    expect(readFileSync(join(artifacts, "tests.log"), "utf8")).not.toContain(
      "fixture-sensitive-value",
    );
    expect(JSON.parse(readFileSync(join(artifacts, "tests.json"), "utf8"))).toMatchObject({
      name: "tests",
      exitCode: 7,
    });
  });

  it("records successful commands and unavailable executables accurately", () => {
    const directory = repository();
    const success = run(directory, [
      "run",
      "types",
      process.execPath,
      "-e",
      'console.log("types passed")',
    ]);
    expect(success.status).toBe(0);
    const unavailable = run(directory, ["run", "missing", join(directory, "unavailable")]);
    expect(unavailable.status).toBe(127);
    const signalled = run(directory, [
      "run",
      "terminated",
      process.execPath,
      "-e",
      'process.kill(process.pid, "SIGTERM")',
    ]);
    expect(signalled.status).toBe(143);
    const summary = run(directory, ["summary", "failure"]);
    expect(summary.status).toBe(0);
    const text = readFileSync(join(directory, "step-summary.md"), "utf8");
    expect(text).toContain("| types | Passed |");
    expect(text).toContain("| missing | Failed (127) |");
    expect(text).toContain("| terminated | Failed (143) |");
  });

  it("copies only sanitized workspace JUnit reports into uploadable diagnostics", () => {
    const directory = repository();
    const rootReport = join(directory, ".artifacts");
    const packageReport = join(directory, "packages/drizzle/.artifacts");
    mkdirSync(rootReport, { recursive: true });
    mkdirSync(packageReport, { recursive: true });
    writeFileSync(
      join(rootReport, "junit.xml"),
      '<testsuites tests="12" failures="0" errors="0"></testsuites>',
    );
    writeFileSync(
      join(packageReport, "junit.xml"),
      '<testsuites tests="9" failures="1" errors="0"><failure>postgresql://user:password@localhost/test</failure></testsuites>',
    );
    writeFileSync(join(directory, ".env"), "SECRET=dotenv-must-not-be-uploaded");
    writeFileSync(join(rootReport, "unrelated.xml"), "not-a-junit-report");
    const summary = run(directory, ["summary", "failure"]);
    expect(summary.status).toBe(0);
    const reports = join(directory, ".artifacts/ci/diagnostics/reports");
    expect(readdirSync(reports).sort()).toEqual(["drizzle.xml", "root.xml"]);
    expect(readFileSync(join(reports, "drizzle.xml"), "utf8")).toContain("[REDACTED URL]");
    const text = readFileSync(join(directory, "step-summary.md"), "utf8");
    expect(text).toContain("| drizzle.xml | 9 | 1 | 0 |");
    expect(text).toContain("| root.xml | 12 | 0 | 0 |");
    expect(text).not.toContain("dotenv-must-not-be-uploaded");
  });

  it("redacts environment secrets, XML entities, multiline keys and credential URLs", () => {
    const secret = 'token<&"value';
    const text = `${secret} token&lt;&amp;&quot;value line-one\nline-two https://name:password@example.com/private`;
    const safe = redactDiagnostics(text, { NPM_TOKEN: secret, PRIVATE_KEY: "line-one\nline-two" });
    expect(safe).not.toContain("token");
    expect(safe).not.toContain("line-one");
    expect(safe).not.toContain("line-two");
    expect(safe).not.toContain("name:password");
    expect(safe).toContain("[REDACTED URL]");
  });

  it("keeps terminal output and per-workspace JUnit reports consistent with cached test outputs", () => {
    expect(workspaceTests().test?.reporters).toEqual([
      "default",
      ["junit", { outputFile: ".artifacts/junit.xml", includeConsoleOutput: false }],
    ]);
  });
});
