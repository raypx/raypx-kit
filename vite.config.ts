import { defineConfig } from "vite-plus";
import { baseLint } from "./packages/devkit/src/lint.js";
import { workspaceTaskConfig } from "./scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  fmt: {
    ignorePatterns: ["docs/src/routeTree.gen.ts"],
  },
  staged: {
    "*.{ts,tsx,mts,json,md,mdx,css,toml}": "vp fmt --write",
    // oxlint only reads scripts and fails when a commit stages none.
    "*.{ts,tsx,mts}": "vp lint --fix",
  },
  lint: {
    ...baseLint,
    ignorePatterns: [
      "packages/*/dist/**",
      // Public consumer contracts resolve installed tarballs, not workspace source.
      // scripts/packages/check.ts type-checks these in their isolated dependency environment.
      "packages/*/tests/fixtures/consumer/**",
      // Browser consumers resolve built exports; the E2E runner lints and checks
      // these explicitly after building their packages with the shared E2E config.
      "packages/*/e2e/**",
      "docs/e2e/**",
      "docs/content/**",
      "docs/.output/**",
      "docs/.source/**",
      "docs/src/routeTree.gen.ts",
    ],
  },
});
