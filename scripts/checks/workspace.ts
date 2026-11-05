import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYAML, stringifyYAML } from "confbox/yaml";

function workspaceConfiguration(root: string) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return {
    packages: manifest.workspaces.packages,
    catalog: manifest.workspaces.catalog,
    overrides: manifest.overrides,
    strictPeerDependencies: false,
    engineStrict: true,
    minimumReleaseAge: 0,
    allowBuilds: {
      "@parcel/watcher": true,
      esbuild: true,
      sharp: true,
      "unrs-resolver": true,
      workerd: true,
      "core-js": false,
      protobufjs: false,
    },
  };
}
export function checkWorkspaceConfiguration(root: string): string[] {
  const file = join(root, "pnpm-workspace.yaml");
  if (!existsSync(file)) return ["pnpm-workspace.yaml: missing; run pnpm run workspace:sync"];
  try {
    if (
      JSON.stringify(parseYAML(readFileSync(file, "utf8"))) ===
      JSON.stringify(workspaceConfiguration(root))
    )
      return [];
  } catch {
    /* Report malformed and stale configuration through the same repair command. */
  }
  return ["pnpm-workspace.yaml: configuration drift; run pnpm run workspace:sync"];
}
if (import.meta.main) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  if (process.argv.slice(2).join(" ") !== "--write")
    throw new Error("Use --write to synchronize workspace configuration");
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    "# Generated from package.json by pnpm run workspace:sync.\n" +
      stringifyYAML(workspaceConfiguration(root)),
  );
}
