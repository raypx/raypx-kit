import {
  assertToolchainRuntime as assertRuntime,
  checkToolchain as checkDeclarations,
} from "../packages/devkit/src/toolchain.js";
import { checkDependencyCompatibility } from "./check-dependencies.js";

/** Repository policy for the shared @raypx-kit/devkit toolchain checks. */
export function checkToolchain(root: string): string[] {
  const declarations = checkDeclarations(root, {
    documents: [
      "README.md",
      "AGENTS.md",
      "docs/AGENTS.md",
      "docs/development/README.md",
      "docs/development/publishing.md",
    ],
    turboGlobalDependencies: [
      ".nvmrc",
      "mise.toml",
      "scripts/toolchain.ts",
      "packages/devkit/src/toolchain.ts",
    ],
  });
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
