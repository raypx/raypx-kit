import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      signed: "src/signed.ts",
      memory: "src/memory.ts",
      fs: "src/fs.ts",
      s3: "src/s3.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
    deps: { neverBundle: [/^aws4fetch(?:\/|$)/] },
  },
});
