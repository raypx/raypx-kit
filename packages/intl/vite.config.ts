import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      client: "src/client.ts",
      browser: "src/browser.ts",
      server: "src/server.ts",
      "types-entry": "src/types-entry.ts",
      testing: "src/testing.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
    deps: {
      // React stays a peer so the application owns the only renderer and context.
      neverBundle: [/^react(?:\/|$)/],
      // Inlined third-party code.
      onlyBundle: [
        "use-intl",
        "intl-messageformat",
        "@formatjs/icu-messageformat-parser",
        "@formatjs/icu-skeleton-parser",
        "@formatjs/fast-memoize",
        "@schummar/icu-type-parser",
      ],
    },
  },
});
