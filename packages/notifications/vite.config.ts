import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: { index: "src/index.ts", react: "src/react.tsx" },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
    deps: { neverBundle: [/^@knocklabs\//, /^react(?:\/|$)/, /^react-dom(?:\/|$)/] },
  },
});
