import devkitConfig from "../../devkit.config.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYAML } from "confbox/yaml";
import {
  assertBunRuntime,
  checkToolchain as checkDeclarations,
} from "../../packages/devkit/src/toolchain.js";
import { checkDependencyCompatibility } from "./dependencies.js";

/** Repository policy for the shared @raypx-kit/devkit toolchain checks. */
export function checkToolchain(root: string): string[] {
  const transport = ".github/actions/setup-node-tools/action.yml";
  const declarations = checkDeclarations(root, devkitConfig.toolchain).filter(
    (finding) => finding !== `${transport}: remove actions/setup-node; Bun is the only runtime`,
  );
  if (existsSync(join(root, transport))) {
    const action = parseYAML(readFileSync(join(root, transport), "utf8")) as {
      runs?: { steps?: { uses?: string; with?: Record<string, unknown> }[] };
    };
    const node = action.runs?.steps?.filter((step) => step.uses?.startsWith("actions/setup-node@"));
    if (
      node?.length !== 1 ||
      node[0]?.with?.["node-version-file"] !== "scripts/packages/node-version"
    )
      declarations.push(
        `${transport}: reserve Node for isolated vendor tools using the consumer baseline`,
      );
  }
  return [...declarations, ...checkDependencyCompatibility(root)];
}

export function assertToolchainRuntime(root: string) {
  try {
    return assertBunRuntime(root);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} Run mise exec -- bun run doctor.`,
    );
  }
}
