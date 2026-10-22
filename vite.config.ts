import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["docs/src/routeTree.gen.ts"] },
  staged: {
    "*.{ts,tsx,mts,json,md,mdx,css,toml}": "vp fmt --write",
    // oxlint only reads scripts and fails when a commit stages none.
    "*.{ts,tsx,mts}": "vp lint --fix",
  },
  lint: {
    ignorePatterns: [
      "packages/*/dist/**",
      // Public consumer contracts resolve installed tarballs, not workspace source.
      // scripts/packages/check.ts type-checks these in their isolated dependency environment.
      "packages/*/tests/fixtures/consumer/**",
      "docs/content/**",
      "docs/.output/**",
      "docs/.source/**",
      "docs/src/routeTree.gen.ts",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
  },
});
