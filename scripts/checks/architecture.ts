import { fileURLToPath } from "node:url";
import devkitConfig from "../../devkit.config.js";
import { checkArchitecture } from "../../packages/devkit/src/architecture.js";
import { discover, exportPaths, type Metadata } from "../../packages/devkit/src/workspaces.js";

/** Check maintained sources before building; archives validate generated payloads later. */
export function checkRepositoryArchitecture(
  root: string,
  metadata: Readonly<Record<string, Metadata>> = devkitConfig.workspaces,
): string[] {
  const index = discover(root, { metadata });
  const findings = checkArchitecture(index);
  for (const workspace of index.workspaces) {
    if (Object.hasOwn(workspace.manifest, "devkit"))
      findings.push(
        `${workspace.path}/package.json: keep devkit metadata only in devkit.config.ts`,
      );
    for (const [entry, value] of Object.entries(workspace.manifest.exports ?? {})) {
      if (
        exportPaths(value).some((path) => path.startsWith("./dist/")) &&
        !workspace.metadata?.sourceEntries?.[entry]
      )
        findings.push(
          `${workspace.path}: generated export ${entry} needs an explicit sourceEntries mapping`,
        );
    }
  }
  return findings;
}

if (import.meta.main) {
  const findings = checkRepositoryArchitecture(fileURLToPath(new URL("../../", import.meta.url)));
  if (findings.length) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  } else console.log("Architecture: workspace sources and boundaries passed.");
}
