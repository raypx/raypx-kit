import { globSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { workspacePatterns } from "../../packages/devkit/src/workspaces.js";

interface Manifest {
  name: string;
  private?: boolean;
  packageManager?: string;
  workspaces?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Member {
  name: string;
  path: string;
  private: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
}

type Input = string | { pattern: string; base: "workspace" } | { auto: boolean };
interface Task {
  command: string;
  dependsOn: string[];
  cache: false | { input: Input[]; output: string[]; env: string[]; untrackedEnv: string[] };
}
export interface TaskModel {
  root: string;
  rootName: string;
  members: Member[];
  tasks: Map<string, Task>;
}

export const taskRef = (owner: string, name: string) => `${owner}#task:${name}`;
export const argumentKey = (ref: string) => `TOOLKIT_TASK_ARGS_${Buffer.from(ref).toString("hex")}`;
const manifest = (root: string, path = "") =>
  JSON.parse(readFileSync(join(root, path, "package.json"), "utf8")) as Manifest;

/** Read workspace data only; task discovery never loads application Vite plugins. */
export function taskModel(root: string, selection?: string): TaskModel {
  const current = manifest(root);
  const members = globSync(
    workspacePatterns(current).map((path) => `${path}/package.json`),
    {
      cwd: root,
    },
  )
    .sort()
    .map((file): Member => {
      const path = file.slice(0, -"/package.json".length);
      const pkg = manifest(root, path);
      return {
        name: pkg.name,
        path,
        private: Boolean(pkg.private),
        scripts: pkg.scripts ?? {},
        dependencies: [
          ...new Set([
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.devDependencies ?? {}),
          ]),
        ],
      };
    });
  const byName = new Map(members.map((member) => [member.name, member]));
  const tasks = new Map<string, Task>();
  const identity = `${process.platform}-${process.arch}-${current.packageManager}`;
  const closure = (member: Member, seen = new Set<Member>()): Set<Member> => {
    if (seen.has(member)) return seen;
    seen.add(member);
    for (const name of member.dependencies) {
      const dependency = byName.get(name);
      if (dependency) closure(dependency, seen);
    }
    return seen;
  };
  const shared = [
    "package.json",
    "bun.lock",
    "mise.toml",
    "devkit.config.ts",
    "scripts/tasks/**",
    "packages/devkit/src/workspaces.ts",
    "tests/config.ts",
    "tests/setup/**",
    "packages/tsconfig/*.json",
  ];
  for (const member of members) {
    const dependencies = member.dependencies.flatMap((name) => {
      const dependency = byName.get(name);
      return dependency ? [dependency] : [];
    });
    for (const name of Object.keys(member.scripts)) {
      const verb = name.split(":")[0];
      const requiresBuilds = ["build", "test", "dev"].includes(verb!);
      const dependsOn = dependencies.flatMap((dependency) => {
        const prerequisite = requiresBuilds ? "build" : verb === "check" ? "check" : undefined;
        return prerequisite && dependency.scripts[prerequisite]
          ? [taskRef(dependency.name, prerequisite)]
          : [];
      });
      if (name === "build" && member.scripts.check) dependsOn.push(taskRef(member.name, "check"));
      const cached = [
        "build",
        "check",
        "test",
        "test:unit",
        "test:component",
        "test:coverage",
      ].includes(name);
      const inputs: Input[] = [
        { auto: true },
        "!**/node_modules/**",
        "!.artifacts/**",
        "!dist/**",
        "!.output/**",
        "!.source/**",
        "!coverage/**",
        ...[
          "!**/.artifacts/**",
          "!.changeset/pack/**",
          "!**/node_modules/**",
          "!**/dist/**",
          "!**/.output/**",
          "!**/.source/**",
          "!**/coverage/**",
        ].map((pattern) => ({ pattern, base: "workspace" as const })),
        ...shared.map((pattern) => ({ pattern, base: "workspace" as const })),
        ...[...closure(member)].flatMap((dependency) =>
          ["src/**", "tests/**", "*.json", "*.config.*"].map((pattern) => ({
            pattern: `${dependency.path}/${pattern}`,
            base: "workspace" as const,
          })),
        ),
      ];
      if (member.path === "docs")
        inputs.push(
          ...["README.md", "PRODUCT.md", "docs/**/*.md", "packages/*/README.md"].map((pattern) => ({
            pattern,
            base: "workspace" as const,
          })),
        );
      const leaf = relative(
        join(root, member.path),
        join(root, "scripts/tasks/leaf.ts"),
      ).replaceAll("\\", "/");
      tasks.set(taskRef(member.name, name), {
        command: `bun ${JSON.stringify(leaf)} ${JSON.stringify(name)} ${argumentKey(taskRef(member.name, name))} ${JSON.stringify(identity)}`,
        dependsOn,
        cache: cached
          ? {
              input: inputs,
              output:
                name === "build"
                  ? ["dist/**", ".output/**"]
                  : name.startsWith("test")
                    ? [".artifacts/junit.xml", "coverage/**"]
                    : [],
              env: [
                "NODE_ENV",
                "CI",
                ...(member.path === "docs" ? ["TOOLKIT_DOCS_PRESET"] : []),
                argumentKey(taskRef(member.name, name)),
              ],
              untrackedEnv: ["*"],
            }
          : false,
      });
    }
  }
  const rootTask = (name: string, command: string, dependsOn: string[] = []) =>
    tasks.set(taskRef(current.name, name), { command, dependsOn, cache: false });
  rootTask("check:root", "bun --check --tsconfig-override tsconfig.json");
  rootTask("test:toolchain", "bun --bun vp test --run --config vitest.config.ts");
  for (const name of ["toolchain:check", "licenses:check", "architecture:check", "lint", "knip"])
    rootTask(name, `bun run ${name}`);
  for (const name of new Set(members.flatMap((member) => Object.keys(member.scripts)))) {
    rootTask(name, `bun scripts/tasks/leaf.ts --aggregate ${JSON.stringify(identity)}`, [
      ...(name === "check" ? [taskRef(current.name, "check:root")] : []),
      ...(name === "test" ? [taskRef(current.name, "test:toolchain")] : []),
      ...members
        .filter((member) => member.scripts[name])
        .map((member) => taskRef(member.name, name)),
    ]);
  }
  rootTask(
    "test:build",
    "bun scripts/tasks/leaf.ts --aggregate",
    ["test", "build"].map((name) => taskRef(current.name, name)).filter((ref) => tasks.has(ref)),
  );
  const selected: unknown = selection ? JSON.parse(selection) : [];
  if (
    !Array.isArray(selected) ||
    selected.some(
      (ref) =>
        typeof ref !== "string" || !tasks.has(ref) || ref === taskRef(current.name, "verify:run"),
    )
  )
    throw new Error("Invalid verification task selection");
  rootTask(
    "verify:run",
    `bun scripts/tasks/leaf.ts --aggregate ${JSON.stringify(identity)}`,
    selected as string[],
  );
  return { root, rootName: current.name, members, tasks };
}

/** Expand the actual VP graph for review, selection tests and cache diagnostics. */
export function taskPlan(model: TaskModel, references: string[]) {
  const selected = new Map<string, Task>();
  const visiting = new Set<string>();
  function visit(ref: string) {
    if (visiting.has(ref)) throw new Error(`Cyclic VP task dependency: ${ref}`);
    if (selected.has(ref)) return;
    const task = model.tasks.get(ref);
    if (!task) throw new Error(`Unknown VP task: ${ref}`);
    visiting.add(ref);
    for (const dependency of task.dependsOn) visit(dependency);
    visiting.delete(ref);
    selected.set(ref, task);
  }
  for (const ref of references) visit(ref);
  return [...selected].map(([ref, task]) => ({ ref, ...task }));
}
