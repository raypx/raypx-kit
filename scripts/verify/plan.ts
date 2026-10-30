import {
  changedFiles as readChanges,
  affectedWorkspaces,
} from "../../packages/devkit/src/verification.js";
import { taskModel, taskRef, type TaskModel } from "../tasks/model.js";
import { browserProjects } from "../../e2e/projects.js";

export interface VerificationPlan {
  full: boolean;
  reasons: string[];
  files: string[];
  workspaces: string[];
  tasks: string[];
  packages: string[];
  browser: string[];
  postgres: boolean;
  release: boolean;
}

export function changedFiles(root: string, base = "origin/canary", head?: string) {
  return readChanges(root, base, head ? { before: base, head } : undefined);
}

/** Reverse workspace dependencies select consumers; documentation also reaches its site. */
export function verificationPlan(
  model: TaskModel,
  files: string[],
  options: { full?: boolean; quick?: boolean; reasons?: string[] } = {},
): VerificationPlan {
  let full = Boolean(options.full || options.reasons?.length);
  const reasons = [...(options.reasons ?? [])];
  const affected = new Set<string>();
  const archives = new Set<string>();
  const docs = model.members.find((member) => member.path === "docs");
  let release = false;
  for (const file of files) {
    if (
      /^(?:package\.json|bun\.lock|mise\.toml|devkit\.config\.ts|(?:vite|vitest|tsconfig|knip|playwright)[^/]*|scripts\/|tests\/|e2e\/|packages\/devkit\/src\/|packages\/tsconfig\/[^/]+\.json$|\.github\/)/.test(
        file,
      )
    ) {
      full = true;
      reasons.push(`Shared verification input: ${file}`);
      continue;
    }
    const owner = model.members.find((member) => file.startsWith(`${member.path}/`));
    const content =
      /(?:^|\/)(?:README|AGENTS|CHANGELOG|LICENSE|NOTICE)(?:\.md)?$/.test(file) ||
      file.endsWith(".md");
    if (file.startsWith(".changeset/")) {
      release = true;
      continue;
    }
    if (content) {
      if (docs) affected.add(docs.name);
      if (owner && !owner.private && !file.endsWith("AGENTS.md")) archives.add(owner.name);
    } else if (owner) affected.add(owner.name);
    else {
      full = true;
      reasons.push(`Unclassified input: ${file}`);
    }
  }
  if (full) for (const member of model.members) affected.add(member.name);
  const reached = affectedWorkspaces(
    model.members,
    new Map([...affected].map((name) => [name, true] as const)),
    { merge: () => true, propagate: () => true },
  );
  for (const name of reached.keys()) affected.add(name);
  for (const member of model.members)
    if (affected.has(member.name) && !member.private) archives.add(member.name);
  const built = new Set([...affected, ...archives]);
  const tasks = [
    "toolchain:check",
    "licenses:check",
    "architecture:check",
    "lint",
    "knip",
    "check:root",
    "test:toolchain",
  ].map((name) => taskRef(model.rootName, name));
  for (const member of model.members) {
    const names = options.quick
      ? ["check", member.scripts["test:unit"] ? "test:unit" : "test"]
      : ["check", "test", "build"];
    for (const name of names)
      if (
        member.scripts[name] &&
        (name === "build" ? built.has(member.name) : affected.has(member.name))
      )
        tasks.push(taskRef(member.name, name));
  }
  return {
    full,
    reasons: [...new Set(reasons)],
    files,
    tasks,
    workspaces: [...affected].sort(),
    packages: options.quick ? [] : [...archives].sort(),
    browser: Object.entries(browserProjects)
      .filter(([, project]) => !options.quick && affected.has(project.workspace))
      .map(([name]) => name),
    postgres: !options.quick && (full || affected.has("@raypx-kit/drizzle")),
    release: !options.quick && (full || release || archives.size > 0),
  };
}

export function localPlan(
  root: string,
  options: { full?: boolean; quick?: boolean; base?: string } = {},
) {
  const changed = changedFiles(root, options.base);
  return verificationPlan(taskModel(root), changed.files, { ...options, reasons: changed.reasons });
}

export function githubPlan(root: string, eventName: string, event: Record<string, unknown>) {
  const pull = event.pull_request as { base?: { sha?: string } } | undefined;
  const full =
    eventName === "workflow_dispatch" ||
    (typeof event.ref === "string" && event.ref.startsWith("refs/tags/"));
  const before =
    eventName === "pull_request"
      ? pull?.base?.sha
      : typeof event.before === "string"
        ? event.before
        : undefined;
  const changed = before
    ? changedFiles(root, before, "HEAD")
    : { files: [], reasons: full ? [] : ["Event base unavailable; running full verification"] };
  return verificationPlan(taskModel(root), changed.files, { full, reasons: changed.reasons });
}
