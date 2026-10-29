import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      postgres: "src/postgres.ts",
      errors: "src/errors.ts",
      results: "src/results.ts",
      diagnostics: "src/diagnostics.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
    deps: { neverBundle: [/^drizzle-orm(?:\/|$)/, /^postgres(?:\/|$)/] },
  },
});
