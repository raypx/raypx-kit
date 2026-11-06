import devkitConfig from "../../devkit.config.js";
import {
  assertNodePnpmRuntime,
  checkToolchain as checkDeclarations,
} from "../../packages/devkit/src/toolchain.js";
import { checkDependencyCompatibility } from "./dependencies.js";

export function checkToolchain(root: string): string[] {
  return [
    ...checkDeclarations(root, devkitConfig.toolchain),
    ...checkDependencyCompatibility(root),
  ];
}
export function assertToolchainRuntime(root: string) {
  return assertNodePnpmRuntime(root);
}
