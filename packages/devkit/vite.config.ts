import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      workspaces: "src/workspaces.ts",
      architecture: "src/architecture.ts",
      toolchain: "src/toolchain.ts",
      process: "src/process.ts",
      artifact: "src/artifact.ts",
      catalogs: "src/catalogs.ts",
      docs: "src/docs.ts",
      lint: "src/lint.ts",
      testing: "src/testing.ts",
      tasks: "src/tasks.ts",
      verification: "src/verification.ts",
      vite: "src/vite.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
  },
});
