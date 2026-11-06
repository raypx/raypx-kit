import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYAML } from "confbox/yaml";

export interface WorkspaceConfiguration {
  packages?: string[];
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

/** Read static package-manager data without loading repository code. */
export function readWorkspaceConfiguration(root: string): WorkspaceConfiguration {
  const yaml = join(root, "pnpm-workspace.yaml");
  if (existsSync(yaml)) {
    const value = parseYAML(readFileSync(yaml, "utf8"), { filename: yaml });
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("pnpm-workspace.yaml: expected a workspace mapping");
    const configuration = value as WorkspaceConfiguration;
    if (
      !Array.isArray(configuration.packages) ||
      !configuration.packages.every((pattern) => typeof pattern === "string" && pattern.length > 0)
    )
      throw new Error("pnpm-workspace.yaml: packages must be an array of non-empty strings");
    return configuration;
  }
  const { workspaces } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return Array.isArray(workspaces) ? { packages: workspaces } : (workspaces ?? {});
}

export function workspaceManifestFiles(root: string) {
  const patterns = readWorkspaceConfiguration(root).packages ?? [];
  return globSync(
    patterns
      .filter((pattern) => !pattern.startsWith("!"))
      .map((pattern) => `${pattern}/package.json`),
    {
      cwd: root,
      exclude: patterns
        .filter((pattern) => pattern.startsWith("!"))
        .map((pattern) => `${pattern.slice(1)}/**`),
    },
  ).sort();
}
