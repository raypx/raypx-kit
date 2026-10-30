import { checkArchitecture } from "@raypx-kit/devkit/architecture";
import { baseLint, strictLint } from "@raypx-kit/devkit/lint";
import { bunTestDefaults } from "@raypx-kit/devkit/testing";
import {
  assertBunRuntime,
  checkToolchain,
  readBunPin,
  type ToolchainOptions,
} from "@raypx-kit/devkit/toolchain";
import { defineConfig } from "vite-plus";
import { mergeConfig } from "vite-plus/test/config";
import {
  discover,
  type DiscoverOptions,
  type Metadata,
  type WorkspaceIndex,
} from "@raypx-kit/devkit/workspaces";

const metadata = {
  "packages/library": {
    kind: "library",
    target: "node",
    sourceEntries: { ".": "./src/index.ts" },
  },
} as const satisfies Readonly<Record<string, Metadata>>;

// Checked against the installed tarball, without workspace source aliases.
export function workspaceConfigContract(root: string) {
  const options = { metadata } satisfies DiscoverOptions;
  const index: WorkspaceIndex = discover(root, options);
  const findings: string[] = checkArchitecture(index);
  const legacy: WorkspaceIndex = discover(root, { metadataKey: "customPolicy" });
  // @ts-expect-error Workspace targets must be one of the supported platforms.
  const invalidTarget: Metadata["target"] = "desktop";
  // @ts-expect-error Supplied metadata must contain workspace metadata values.
  const invalidOptions: DiscoverOptions = { metadata: { "packages/library": "node" } };
  return { index, findings, legacy, invalidTarget, invalidOptions };
}

export function repositoryConfigContract(root: string) {
  const policy = { runtime: "bun", documents: ["README.md"] } satisfies ToolchainOptions;
  const findings: string[] = checkToolchain(root, policy);
  const bun: string = readBunPin(root);
  const active: { bun: string } = assertBunRuntime(root);
  const base = defineConfig({ lint: baseLint });
  const strict = defineConfig({ lint: strictLint });
  const tests = mergeConfig(bunTestDefaults, { test: { include: ["tests/**/*.test.ts"] } });
  // @ts-expect-error Runtime policy accepts only the supported repository modes.
  const invalid: ToolchainOptions = { runtime: "deno" };
  return { findings, bun, active, base, strict, tests, invalid };
}

import {
  createTaskModel,
  taskConfig,
  taskPlan,
  taskRef,
  type TaskMember,
  type TaskPolicy,
} from "@raypx-kit/devkit/tasks";
import { affectedWorkspaces } from "@raypx-kit/devkit/verification";
import { startEnvironment } from "@raypx-kit/devkit/vite";
export function taskContract(root: string, url: string) {
  const policy: TaskPolicy<TaskMember> = {
    member: (_, member) => member,
    define: () => ({ command: "bun run build", dependsOn: [], cache: false }),
    aggregateCommand: "bun leaf.ts --aggregate",
  };
  const model = createTaskModel(root, policy);
  const plan = taskPlan(model, [taskRef(model.rootName, "build")]);
  const config = defineConfig(taskConfig(model, url));
  const reached = affectedWorkspaces(model.members, new Map<string, boolean>(), {
    merge: () => true,
    propagate: () => true,
  });
  const plugin = startEnvironment(
    [{ name: "tanstack-start-core:load-env", configResolved() {} }],
    () => ({}),
  );
  return { plan, config, reached, plugin };
}
