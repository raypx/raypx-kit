import type { ToolchainOptions } from "./packages/devkit/src/toolchain.js";
import type { Metadata } from "./packages/devkit/src/workspaces.js";

/** Repository policy; runtime pins and public package contracts keep their own sources. */
export default {
  workspaces: {
    "packages/codemods": {
      kind: "tooling",
      target: "node",
      sourceEntries: {
        ".": "./src/index.ts",
      },
    },
    docs: {
      kind: "app",
      target: "browser",
    },
    "packages/devkit": {
      kind: "tooling",
      target: "node",
      sourceEntries: {
        "./workspaces": "./src/workspaces.ts",
        "./architecture": "./src/architecture.ts",
        "./toolchain": "./src/toolchain.ts",
        "./process": "./src/process.ts",
        "./artifact": "./src/artifact.ts",
        "./catalogs": "./src/catalogs.ts",
        "./docs": "./src/docs.ts",
      },
    },
    "packages/drizzle": {
      kind: "library",
      target: "universal",
      sourceEntries: {
        ".": "./src/index.ts",
        "./postgres": "./src/postgres.ts",
        "./errors": "./src/errors.ts",
        "./results": "./src/results.ts",
        "./diagnostics": "./src/diagnostics.ts",
      },
    },
    "packages/drizzle-kit": {
      kind: "tooling",
      target: "node",
      sourceEntries: {
        ".": "./src/extract.ts",
      },
    },
    "packages/env": {
      kind: "library",
      target: "universal",
      sourceEntries: {
        ".": "./src/index.ts",
        "./runtime": "./src/runtime.ts",
      },
    },
    "packages/intl": {
      kind: "library",
      target: "universal",
      entryTargets: {
        "./browser": "browser",
      },
      sourceTargets: {
        "src/browser.ts": "browser",
      },
      sourceEntries: {
        ".": "./src/index.ts",
        "./client": "./src/client.ts",
        "./browser": "./src/browser.ts",
        "./server": "./src/server.ts",
        "./types": "./src/types-entry.ts",
        "./testing": "./src/testing.ts",
      },
      bundledDependencies: ["use-intl", "@formatjs/icu-messageformat-parser"],
    },
    "packages/logger": {
      kind: "library",
      target: "node",
      sourceEntries: {
        ".": "./src/index.ts",
        "./context": "./src/context.ts",
        "./pipeline": "./src/pipeline.ts",
      },
    },
    "packages/tsconfig": {
      kind: "tooling",
      target: "universal",
    },
  },
  toolchain: {
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
      "devkit.config.ts",
      "scripts/checks/toolchain.ts",
      "packages/devkit/src/toolchain.ts",
    ],
  },
} satisfies {
  workspaces: Readonly<Record<string, Metadata>>;
  toolchain: ToolchainOptions;
};
