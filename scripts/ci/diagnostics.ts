import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { constants } from "node:os";
import { join, resolve } from "node:path";

interface StageResult {
  name: string;
  exitCode: number | null;
  durationSeconds: number;
}

/** Artifact uploads do not inherit GitHub's console masking. Redact before writing files. */
export function redactDiagnostics(text: string, env: NodeJS.ProcessEnv = process.env): string {
  const values = Object.entries(env)
    .filter(([name]) =>
      /(?:token|password|secret|credential|authorization|private_key|database_url)/i.test(name),
    )
    .flatMap(([, value]) => (value ? [value, ...value.split(/\r?\n/)] : []))
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length);
  let redacted = text;
  for (const value of values) {
    for (const representation of [
      value,
      value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;"),
    ]) {
      redacted = redacted.replaceAll(representation, "[REDACTED]");
    }
  }
  return redacted.replace(
    /\b(?:postgres(?:ql)?|https?):\/\/[^\s<>"']*:[^\s<>"']*@[^\s<>"']+/gi,
    "[REDACTED URL]",
  );
}

function directories() {
  const root = resolve(process.env.RAYPX_CI_DIAGNOSTICS_DIRECTORY ?? ".artifacts/ci");
  const artifacts = join(root, "diagnostics");
  mkdirSync(artifacts, { recursive: true });
  return { root, artifacts };
}

/** Keep the child's exit status: collecting diagnostics must never turn a failure green. */
export async function runStage(name: string, command: string[]): Promise<number> {
  if (!/^[a-z][a-z0-9-]*$/.test(name) || !command.length) {
    throw new Error(
      "Usage: bun scripts/ci/diagnostics.ts run <stage-name> <command> [arguments...]",
    );
  }
  const { artifacts } = directories();
  const log = join(artifacts, `${name}.log`);
  const metadata = join(artifacts, `${name}.json`);
  const started = performance.now();
  writeFileSync(log, "");
  const save = (exitCode: number | null) => {
    const result: StageResult = {
      name,
      exitCode,
      durationSeconds: Math.round((performance.now() - started) / 100) / 10,
    };
    writeFileSync(metadata, `${JSON.stringify(result, null, 2)}\n`);
  };
  save(null);
  const child = spawn(command[0]!, command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  const output = (text: string, stream: NodeJS.WriteStream) => {
    const safe = redactDiagnostics(text);
    appendFileSync(log, safe);
    stream.write(safe);
  };
  for (const [input, destination] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ] as const) {
    let pending = "";
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      pending += chunk;
      const newline = pending.lastIndexOf("\n");
      if (newline < 0) return;
      output(pending.slice(0, newline + 1), destination);
      pending = pending.slice(newline + 1);
    });
    input.on("end", () => {
      if (pending) output(pending, destination);
    });
  }
  let unavailable = false;
  child.on("error", (error) => {
    unavailable = true;
    output(`${error.message}\n`, process.stderr);
  });
  const exitCode = await new Promise<number>((done) => {
    child.on("close", (code, signal) =>
      done(unavailable ? 127 : (code ?? (signal ? 128 + constants.signals[signal] : 1))),
    );
  });
  save(exitCode);
  return exitCode;
}

export function writeSummary(status: string): string {
  if (!["success", "failure", "cancelled", "skipped"].includes(status)) {
    throw new Error("A GitHub job status is required for the diagnostic summary.");
  }
  const { artifacts } = directories();
  const stages = readdirSync(artifacts)
    .filter((file) => /^[a-z][a-z0-9-]*\.json$/.test(file))
    .map((file) => JSON.parse(readFileSync(join(artifacts, file), "utf8")) as StageResult);
  const packages = join(process.cwd(), "packages");
  const workspaces = [
    { name: "root", directory: process.cwd() },
    ...(existsSync(packages) ? readdirSync(packages, { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && /^[a-zA-Z0-9_-]+$/.test(entry.name))
      .map((entry) => ({ name: entry.name, directory: join(packages, entry.name) })),
  ];
  const reportFiles = workspaces
    .map((workspace) => ({
      name: `${workspace.name}.xml`,
      file: join(workspace.directory, ".artifacts/junit.xml"),
    }))
    .filter((report) => existsSync(report.file));
  if (reportFiles.length) mkdirSync(join(artifacts, "reports"), { recursive: true });
  const reportRows = reportFiles.map(({ name, file }) => {
    const report = redactDiagnostics(readFileSync(file, "utf8"));
    writeFileSync(join(artifacts, "reports", name), report);
    const suite = report.match(/<testsuites\b([^>]*)>/)?.[1] ?? "";
    const count = (attribute: string) =>
      suite.match(new RegExp(`\\b${attribute}="(\\d+)"`))?.[1] ?? "—";
    return `| ${name} | ${count("tests")} | ${count("failures")} | ${count("errors")} |`;
  });
  const summary = [
    `## ${process.env.GITHUB_JOB ?? "CI"}: ${status}`,
    "",
    "| Stage | Result | Seconds |",
    "| --- | --- | ---: |",
    ...stages.map(
      (stage) =>
        `| ${stage.name} | ${stage.exitCode === null ? "Interrupted" : stage.exitCode === 0 ? "Passed" : `Failed (${stage.exitCode})`} | ${stage.durationSeconds} |`,
    ),
    ...(stages.length ? [] : ["| Setup | No command stages completed | — |"]),
    "",
    ...(reportRows.length
      ? [
          "| JUnit report | Tests | Failures | Errors |",
          "| --- | ---: | ---: | ---: |",
          ...reportRows,
          "",
        ]
      : []),
    "Logs and JUnit reports are retained for 7 days when this job fails. Reports are sanitized before upload; environment files and consumer installations are excluded.",
    "",
  ].join("\n");
  writeFileSync(join(artifacts, "summary.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  return summary;
}

if (import.meta.main) {
  const [operation, name, ...command] = process.argv.slice(2);
  if (operation === "run" && name) process.exitCode = await runStage(name, command);
  else if (operation === "summary" && name && !command.length) writeSummary(name);
  else
    throw new Error("Usage: bun scripts/ci/diagnostics.ts <run stage command... | summary status>");
}
