import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTOML } from "confbox/toml";
import { parseYAML } from "confbox/yaml";
import { readWorkspaceConfiguration, workspaceManifestFiles } from "./workspace-config.js";

export interface Toolchain {
  node: string;
  bun: string;
}

export interface ToolchainOptions {
  /** Select Bun-only or Node/pnpm policy; the default checks Node and Bun. */
  runtime?: "node-bun" | "bun" | "node-pnpm";
  /** Repository-relative documents whose runtime and package-manager pins must match. */
  documents?: readonly string[];
  /** Files every Turbo cache key must include when `turbo.json` exists. */
  turboGlobalDependencies?: readonly string[];
}

export interface RuntimeOptions {
  /** Environment variable that may select a Node executable outside PATH. */
  nodeBinaryEnv?: string;
}

interface Manifest {
  packageManager?: string;
  engines?: { node?: string };
  devEngines?: Record<string, { name?: string; version?: string; onFail?: string }>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

const exactVersion = /^\d+\.\d+\.\d+$/;
const manifestAt = (root: string, file = "package.json"): Manifest =>
  JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
const catalogsOf = (root: string): Record<string, string>[] => {
  const { catalog, catalogs } = readWorkspaceConfiguration(root);
  return [...(catalog ? [catalog] : []), ...Object.values(catalogs ?? {})];
};

const bunVersion = (root: string) =>
  /^bun@(\d+\.\d+\.\d+)$/.exec(manifestAt(root).packageManager ?? "")?.[1];

/** Read the exact Bun pin without requiring a Node development runtime. */
export function readBunPin(root: string): string {
  const bun = bunVersion(root);
  if (!bun) throw new Error("Pin an exact Bun version in package.json packageManager.");
  return bun;
}

function assertBunVersion(bun: string) {
  if (process.versions.bun !== bun)
    throw new Error(`Expected Bun ${bun}, got ${process.versions.bun ?? "none"}.`);
}

/** Check the active Bun runtime without executing Node or inspected repository code. */
export function assertBunRuntime(root: string): { bun: string } {
  const bun = readBunPin(root);
  assertBunVersion(bun);
  return { bun };
}

/** `.nvmrc` pins Node and the root `packageManager` pins Bun; every other pin follows them. */
export function readToolchain(root: string): Toolchain {
  const node = readFileSync(join(root, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  const bun = bunVersion(root) ?? "";
  if (!exactVersion.test(node) || !exactVersion.test(bun))
    throw new Error("Pin exact Node and Bun versions in .nvmrc and package.json packageManager.");
  return { node, bun };
}

/** Returns the Node executable after confirming it provides the pinned release. */
export function pinnedNode(
  root: string,
  { nodeBinaryEnv = "DEVKIT_NODE_BINARY" }: RuntimeOptions = {},
) {
  const pins = readToolchain(root);
  const nodeBinary = process.env[nodeBinaryEnv] || "node";
  let node: string;
  try {
    node = execFileSync(nodeBinary, ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    throw new Error(
      `Node is unavailable; select Node ${pins.node} from .nvmrc or set ${nodeBinaryEnv}.`,
    );
  }
  if (node !== `v${pins.node}`)
    throw new Error(
      `Expected Node ${pins.node}, got ${node}; select the pinned Node from .nvmrc or set ${nodeBinaryEnv}.`,
    );
  return nodeBinary;
}

/** The binary override changes the consumer executable, never the required version. */
export function assertToolchainRuntime(
  root: string,
  options: RuntimeOptions = {},
): Toolchain & { nodeBinary: string } {
  const pins = readToolchain(root);
  assertBunVersion(pins.bun);
  return { ...pins, nodeBinary: pinnedNode(root, options) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkMise(root: string, bunOnly: boolean): string[] {
  const file = "mise.toml";
  const path = join(root, file);
  if (!existsSync(path)) return [`${file}: missing runtime manager configuration`];
  let mise: unknown;
  try {
    mise = parseTOML(readFileSync(path, "utf8"));
  } catch {
    return [`${file}: invalid TOML configuration`];
  }
  if (!isRecord(mise)) return [`${file}: configuration must be a table`];
  const findings: string[] = [];
  if (Object.hasOwn(mise, "tools"))
    findings.push(`${file}: read existing pins instead of declaring [tools] versions`);
  const tools = isRecord(mise.settings)
    ? mise.settings.idiomatic_version_file_enable_tools
    : undefined;
  const expected = bunOnly ? ["bun"] : ["node", "bun"];
  if (
    !Array.isArray(tools) ||
    tools.length !== expected.length ||
    !expected.every((tool) => tools.includes(tool))
  )
    findings.push(
      `${file}: enable idiomatic version files for ${bunOnly ? "bun only" : "node and bun"}`,
    );
  return findings;
}

function checkSetupStep(
  file: string,
  location: string,
  step: Record<string, unknown>,
  bunOnly: boolean,
): string[] {
  if (typeof step.uses !== "string") return [];
  const refSeparator = step.uses.indexOf("@");
  if (refSeparator < 0) return [];
  const repository = step.uses.slice(0, refSeparator).toLowerCase();
  const setup = (
    [
      ["node", "actions/setup-node", ".nvmrc"],
      ["bun", "oven-sh/setup-bun", "package.json"],
    ] as const
  ).find(([, action]) => repository === action);
  if (!setup) return [];
  const [tool, , source] = setup;
  if (bunOnly && tool === "node")
    return [`${file}: remove actions/setup-node; Bun is the only runtime`];
  const findings: string[] = [];
  if (step.with !== undefined && !isRecord(step.with))
    findings.push(`${file}: ${location}.with must be a mapping`);
  const inputs = isRecord(step.with) ? step.with : {};
  if (Object.hasOwn(inputs, `${tool}-version`))
    findings.push(`${file}: read ${tool}-version-file: ${source} instead of a literal version`);
  const versionFile = inputs[`${tool}-version-file`];
  if (versionFile === undefined) findings.push(`${file}: every ${tool} setup must read ${source}`);
  else if (versionFile !== source) findings.push(`${file}: ${tool}-version-file must be ${source}`);
  return findings;
}

function checkSetupSteps(
  file: string,
  location: string,
  steps: unknown,
  bunOnly: boolean,
): string[] {
  if (!Array.isArray(steps)) return [`${file}: ${location} must be an array`];
  const findings: string[] = [];
  for (const [index, step] of steps.entries()) {
    const stepLocation = `${location}[${index}]`;
    if (!isRecord(step)) {
      findings.push(`${file}: ${stepLocation} must be a mapping`);
      continue;
    }
    findings.push(...checkSetupStep(file, stepLocation, step, bunOnly));
  }
  return findings;
}

function checkWorkflows(root: string, bunOnly: boolean): string[] {
  const findings: string[] = [];
  for (const file of globSync(".github/workflows/*.{yml,yaml}", { cwd: root })) {
    let workflow: unknown;
    try {
      workflow = parseYAML(readFileSync(join(root, file), "utf8"), { filename: file });
    } catch {
      findings.push(`${file}: invalid YAML configuration`);
      continue;
    }
    if (!isRecord(workflow) || !isRecord(workflow.jobs)) {
      findings.push(`${file}: workflow jobs must be a mapping`);
      continue;
    }
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const location = `jobs.${name}`;
      if (!isRecord(job)) {
        findings.push(`${file}: ${location} must be a mapping`);
        continue;
      }
      if (job.steps === undefined) continue;
      findings.push(...checkSetupSteps(file, `${location}.steps`, job.steps, bunOnly));
    }
  }
  return findings;
}

function checkCompositeActions(root: string, bunOnly: boolean): string[] {
  const findings: string[] = [];
  for (const file of globSync(".github/actions/**/action.{yml,yaml}", { cwd: root })) {
    let action: unknown;
    try {
      action = parseYAML(readFileSync(join(root, file), "utf8"), { filename: file });
    } catch {
      findings.push(`${file}: invalid YAML configuration`);
      continue;
    }
    if (!isRecord(action) || !isRecord(action.runs)) {
      findings.push(`${file}: action runs must be a mapping`);
      continue;
    }
    if (action.runs.using !== "composite") continue;
    findings.push(...checkSetupSteps(file, "runs.steps", action.runs.steps, bunOnly));
  }
  return findings;
}

/** Check duplicated declarations without installing tools or running application code. */
export function checkToolchain(
  root: string,
  {
    runtime = "node-bun",
    documents = ["README.md", "AGENTS.md"],
    turboGlobalDependencies = runtime === "bun" ? ["mise.toml"] : [".nvmrc", "mise.toml"],
  }: ToolchainOptions = {},
): string[] {
  if (runtime === "node-pnpm") return checkNodePnpmToolchain(root, documents);
  const bunOnly = runtime === "bun";
  let pins: { bun: string; node?: string };
  try {
    pins = bunOnly ? { bun: readBunPin(root) } : readToolchain(root);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const findings: string[] = [];
  const manifest = manifestAt(root);
  const expect = (file: string, label: string, actual: string | undefined, expected: string) => {
    if (actual !== expected)
      findings.push(`${file}: ${label} is ${actual ?? "missing"}, expected ${expected}`);
  };
  if (bunOnly) {
    if (manifest.engines?.node !== undefined)
      findings.push("package.json: remove engines.node; Bun is the only runtime");
  } else expect("package.json", "engines.node", manifest.engines?.node, pins.node!);
  for (const key of ["packageManager", "runtime"]) {
    const engine = manifest.devEngines?.[key];
    expect(
      "package.json",
      `devEngines.${key}`,
      `${engine?.name}@${engine?.version}`,
      `bun@${pins.bun}`,
    );
    expect("package.json", `devEngines.${key}.onFail`, engine?.onFail, "error");
  }
  for (const file of [
    ...(bunOnly ? [".nvmrc"] : []),
    ".node-version",
    ".bun-version",
    ".tool-versions",
  ])
    if (existsSync(join(root, file)))
      findings.push(
        bunOnly
          ? `${file}: package.json packageManager is the only runtime pin`
          : `${file}: use .nvmrc and package.json instead of a second version source`,
      );
  findings.push(...checkMise(root, bunOnly));

  // Runtime type packages follow the pins: @types/node by major, @types/bun exactly.
  const nodeMajor = pins.node?.split(".")[0];
  // Protocol ranges such as catalog: and workspace: are checked where they resolve.
  const version = (range: string | undefined) =>
    range && !/^[a-z]+:/.test(range) ? range.replace(/^[\^~]/, "") : undefined;
  const checkTypes = (file: string, dependencies: Record<string, string> | undefined) => {
    const node = version(dependencies?.["@types/node"]);
    if (nodeMajor && node && node.split(".")[0] !== nodeMajor)
      findings.push(`${file}: @types/node must match the Node ${nodeMajor} major`);
    const bun = version(dependencies?.["@types/bun"]);
    if (bun) expect(file, "@types/bun", bun, pins.bun);
  };
  const catalogFile = existsSync(join(root, "pnpm-workspace.yaml"))
    ? "pnpm-workspace.yaml"
    : "package.json";
  for (const catalog of catalogsOf(root)) checkTypes(`${catalogFile} catalog`, catalog);
  for (const file of ["package.json", ...workspaceManifestFiles(root)])
    checkTypes(file, manifestAt(root, file).devDependencies);

  for (const file of globSync("**/Dockerfile", { cwd: root, exclude: ["**/node_modules/**"] })) {
    const source = readFileSync(join(root, file), "utf8");
    if (bunOnly) {
      if (/^\s*FROM\s+(?:--platform=\S+\s+)?node:/im.test(source))
        findings.push(`${file}: build and run on oven/bun images`);
    } else {
      for (const [, version] of source.matchAll(/^FROM\s+node:(\d+\.\d+\.\d+)/gm))
        expect(file, "node image", version, pins.node!);
    }
    for (const [, version] of source.matchAll(/^FROM\s+oven\/bun:(\d+\.\d+\.\d+)/gm))
      expect(file, "bun image", version, pins.bun);
  }
  findings.push(...checkWorkflows(root, bunOnly), ...checkCompositeActions(root, bunOnly));
  for (const file of documents) {
    if (!existsSync(join(root, file))) continue;
    const document = readFileSync(join(root, file), "utf8").replaceAll("**", "");
    for (const [, tool, version] of document.matchAll(/\b(Node|Bun) v?(\d+\.\d+\.\d+)\b/g)) {
      if (bunOnly && tool === "Node")
        findings.push(`${file}: documents a Node release; Bun is the only runtime`);
      else expect(file, `documented ${tool}`, version, tool === "Node" ? pins.node! : pins.bun);
    }
  }
  const turboFile = join(root, "turbo.json");
  if (existsSync(turboFile)) {
    const turbo = JSON.parse(readFileSync(turboFile, "utf8")) as { globalDependencies?: string[] };
    for (const file of turboGlobalDependencies)
      if (!turbo.globalDependencies?.includes(file))
        findings.push(`turbo.json: include ${file} in globalDependencies`);
  }
  return [...new Set(findings)];
}

/** Root manifest pins for repositories developed with Node and pnpm. */
export function readNodePnpmPins(root: string): { node: string; pnpm: string } {
  const manifest = manifestAt(root);
  const node = manifest.engines?.node;
  const pnpm = /^pnpm@(\d+\.\d+\.\d+)$/.exec(manifest.packageManager ?? "")?.[1];
  if (!node || !exactVersion.test(node) || !pnpm)
    throw new Error(
      "Pin exact Node and pnpm versions in package.json engines.node and packageManager.",
    );
  return { node, pnpm };
}

/** Check the active executables without changing the user's runtime selection. */
export function assertNodePnpmRuntime(root: string): { node: string; pnpm: string } {
  const pins = readNodePnpmPins(root);
  if (process.versions.bun || process.versions.node !== pins.node)
    throw new Error(
      `Expected Node ${pins.node}, got ${process.versions.bun ? "Bun" : process.versions.node}.`,
    );
  const actual = execFileSync("pnpm", ["--version"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
  if (actual !== pins.pnpm) throw new Error(`Expected pnpm ${pins.pnpm}, got ${actual}.`);
  return pins;
}

function checkNodePnpmToolchain(root: string, documents: readonly string[]): string[] {
  let pins: { node: string; pnpm: string };
  try {
    pins = readNodePnpmPins(root);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const findings: string[] = [];
  const manifest = manifestAt(root);
  for (const [key, name, version] of [
    ["runtime", "node", pins.node],
    ["packageManager", "pnpm", pins.pnpm],
  ] as const) {
    const engine = manifest.devEngines?.[key];
    if (engine?.name !== name || engine.version !== version || engine.onFail !== "error")
      findings.push(`package.json: devEngines.${key} must require ${name}@${version}`);
  }
  for (const file of [
    "bun.lock",
    "bunfig.toml",
    ".bun-version",
    ".nvmrc",
    ".node-version",
    ".tool-versions",
  ])
    if (existsSync(join(root, file))) findings.push(`${file}: use the root Node/pnpm pins only`);
  try {
    const mise = parseTOML<{
      tools?: unknown;
      settings?: { idiomatic_version_file_enable_tools?: string[] };
    }>(readFileSync(join(root, "mise.toml"), "utf8"));
    if (
      mise.tools ||
      JSON.stringify(mise.settings?.idiomatic_version_file_enable_tools) !== '["node"]'
    )
      findings.push("mise.toml: read the package.json Node pin without a tools section");
  } catch {
    findings.push("mise.toml: invalid runtime manager configuration");
  }
  for (const file of globSync(
    [".github/workflows/*.{yml,yaml}", ".github/actions/**/action.{yml,yaml}"],
    { cwd: root },
  )) {
    type Step = { uses?: string; with?: Record<string, unknown> };
    let document: { runs?: { steps?: Step[] }; jobs?: Record<string, { steps?: Step[] }> };
    try {
      document = parseYAML(readFileSync(join(root, file), "utf8"));
    } catch {
      findings.push(`${file}: invalid YAML`);
      continue;
    }
    for (const step of [
      ...(document.runs?.steps ?? []),
      ...Object.values(document.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ]) {
      if (step.uses?.startsWith("oven-sh/setup-bun@"))
        findings.push(`${file}: use the Node/pnpm toolchain`);
      if (
        step.uses?.startsWith("actions/setup-node@") &&
        (step.with?.["node-version-file"] !== "package.json" || step.with?.["node-version"])
      )
        findings.push(`${file}: setup-node must read package.json`);
      if (step.uses?.startsWith("pnpm/action-setup@") && step.with?.version)
        findings.push(`${file}: pnpm setup must read packageManager`);
    }
  }
  for (const file of documents) {
    if (!existsSync(join(root, file))) continue;
    const document = readFileSync(join(root, file), "utf8").replaceAll("**", "");
    for (const [, tool, version] of document.matchAll(/\b(Node|pnpm) v?(\d+\.\d+\.\d+)\b/g))
      if (version !== (tool === "Node" ? pins.node : pins.pnpm))
        findings.push(`${file}: documented ${tool} pin differs from package.json`);
  }
  return findings;
}
