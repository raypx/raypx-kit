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
        "./lint": "./src/lint.ts",
        "./testing": "./src/testing.ts",
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
    "packages/email-preview": {
      kind: "tooling",
      target: "node",
      sourceEntries: {
        ".": "./src/index.ts",
      },
      sourceTargets: {
        "src/ui/**": "browser",
      },
      // The static interface is prebuilt into the published package.
      bundledDependencies: [
        "@tanstack/react-router",
        "react",
        "react-dom",
        "@raypx-kit/ui",
        "@raypx-kit/themes",
      ],
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
    "packages/analytics": {
      kind: "library",
      target: "universal",
      entryTargets: { "./browser": "browser", "./react": "browser" },
      sourceTargets: { "src/browser.ts": "browser", "src/react.tsx": "browser" },
      sourceEntries: {
        ".": "./src/index.ts",
        "./browser": "./src/browser.ts",
        "./react": "./src/react.tsx",
      },
    },
    "packages/logger": {
      kind: "library",
      target: "node",
      sourceEntries: {
        ".": "./src/index.ts",
        "./context": "./src/context.ts",
        "./pipeline": "./src/pipeline.ts",
        "./safe": "./src/safe.ts",
        "./stream": "./src/stream.ts",
      },
    },
    "packages/notifications": {
      kind: "library",
      target: "node",
      entryTargets: { "./react": "browser" },
      sourceTargets: { "src/react.tsx": "browser" },
      sourceEntries: {
        ".": "./src/index.ts",
        "./react": "./src/react.tsx",
      },
    },
    "packages/security": {
      kind: "library",
      target: "universal",
      entryTargets: { "./arcjet": "node" },
      sourceTargets: { "src/arcjet.ts": "node" },
      sourceEntries: {
        ".": "./src/index.ts",
        "./arcjet": "./src/arcjet.ts",
      },
    },
    "packages/storage": {
      kind: "library",
      target: "universal",
      entryTargets: {
        "./fs": "node",
      },
      sourceTargets: {
        "src/fs.ts": "node",
      },
      sourceEntries: {
        ".": "./src/index.ts",
        "./signed": "./src/signed.ts",
        "./memory": "./src/memory.ts",
        "./fs": "./src/fs.ts",
        "./s3": "./src/s3.ts",
      },
    },
    "packages/tsconfig": {
      kind: "tooling",
      target: "universal",
    },
    "packages/themes": {
      kind: "library",
      target: "browser",
      entryTargets: { "./config": "universal", "./script": "universal" },
      sourceTargets: {
        "src/config.ts": "universal",
        "src/tokens.ts": "universal",
        "src/script.ts": "universal",
        "scripts/**": "node",
      },
      sourceEntries: {
        ".": "./src/index.ts",
        "./config": "./src/config.ts",
        "./script": "./src/script.ts",
      },
    },
    "packages/ui": {
      kind: "library",
      target: "browser",
      entryTargets: { "./lib/utils": "universal" },
      sourceTargets: { "src/lib/utils.ts": "universal" },
      sourceEntries: {
        ".": "./src/index.ts",
        "./components/ui/button": "./src/components/ui/button.tsx",
        "./components/ui/input": "./src/components/ui/input.tsx",
        "./components/ui/tabs": "./src/components/ui/tabs.tsx",
        "./components/ui/badge": "./src/components/ui/badge.tsx",
        "./components/ui/dialog": "./src/components/ui/dialog.tsx",
        "./components/ui/skeleton": "./src/components/ui/skeleton.tsx",
        "./components/ui/native-select": "./src/components/ui/native-select.tsx",
        "./lib/utils": "./src/lib/utils.ts",
      },
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
