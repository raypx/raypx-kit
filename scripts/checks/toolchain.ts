import devkitConfig from "../../devkit.config.js";
import {
  assertToolchainRuntime as assertRuntime,
  checkToolchain as checkDeclarations,
} from "../../packages/devkit/src/toolchain.js";
import { checkDependencyCompatibility } from "./dependencies.js";

/** Repository policy for the shared @raypx-kit/devkit toolchain checks. */
export function checkToolchain(root: string): string[] {
  const declarations = checkDeclarations(root, devkitConfig.toolchain);
  return [...declarations, ...checkDependencyCompatibility(root)];
}

export function assertToolchainRuntime(root: string) {
  try {
    return assertRuntime(root, { nodeBinaryEnv: "TOOLKIT_NODE_BINARY" });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} Run mise exec -- bun run doctor.`,
    );
  }
}
