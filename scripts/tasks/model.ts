import { join, relative } from "node:path";
import {
  createTaskModel,
  taskPlan,
  taskRef,
  argumentKey,
  type TaskMember,
  type TaskModel as SharedTaskModel,
  type TaskContext,
  type TaskDefinition,
  type TaskInput,
} from "../../packages/devkit/src/tasks.js";
export { taskPlan, taskRef, argumentKey };
interface Member extends TaskMember {
  private: boolean;
}
export type TaskModel = SharedTaskModel<Member> & { tasks: Map<string, TaskDefinition> };
const shared = [
  "package.json",
  "bun.lock",
  "mise.toml",
  "devkit.config.ts",
  "scripts/tasks/**",
  "packages/devkit/src/workspaces.ts",
  "packages/devkit/src/tasks.ts",
  "packages/devkit/src/tasks/**",
  "packages/devkit/src/vite.ts",
  "tests/config.ts",
  "tests/setup/**",
  "packages/tsconfig/*.json",
];

function definition(member: Member, name: string, context: TaskContext<Member>): TaskDefinition {
  const { root, members } = context;
  const verb = name.split(":")[0];
  const requiresBuilds = ["build", "test", "dev"].includes(verb!);
  const dependencies = members.filter((candidate) => member.dependencies.includes(candidate.name));
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
  const inputs: TaskInput[] = [
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
    ...context.dependencyClosure(member).flatMap((dependency) =>
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

  const leaf = relative(join(root, member.path), join(root, "scripts/tasks/leaf.ts")).replaceAll(
    "\\",
    "/",
  );
  const identity = `${process.platform}-${process.arch}-${String(context.manifest.packageManager)}`;
  return {
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
  };
}

export function taskModel(root: string, selection?: string): TaskModel {
  const model = createTaskModel<Member>(
    root,
    {
      member: (workspace, member) => ({ ...member, private: Boolean(workspace.manifest.private) }),
      define: definition,
      aggregateCommand: `bun scripts/tasks/leaf.ts --aggregate "${process.platform}-${process.arch}"`,
      rootTasks({ rootName, members }) {
        const task = (command: string, dependsOn: string[] = []): TaskDefinition => ({
          command,
          dependsOn,
          cache: false,
        });
        const roots: Record<string, TaskDefinition> = {
          "check:root": task("bun --check --tsconfig-override tsconfig.json"),
          "test:toolchain": task("bun --bun vp test --run --config vitest.config.ts"),
        };
        for (const name of [
          "toolchain:check",
          "licenses:check",
          "architecture:check",
          "lint",
          "knip",
        ])
          roots[name] = task(`bun run ${name}`);
        for (const name of ["check", "test"])
          if (members.some((member) => member.scripts[name]))
            roots[name] = task("bun scripts/tasks/leaf.ts --aggregate", [
              taskRef(rootName, name === "check" ? "check:root" : "test:toolchain"),
              ...members
                .filter((member) => member.scripts[name])
                .map((member) => taskRef(member.name, name)),
            ]);
        roots["test:build"] = task(
          "bun scripts/tasks/leaf.ts --aggregate",
          ["test", "build"]
            .filter((name) => members.some((member) => member.scripts[name]))
            .map((name) => taskRef(rootName, name)),
        );
        return roots;
      },
    },
    selection,
  );
  return { ...model, tasks: model.definitions };
}
