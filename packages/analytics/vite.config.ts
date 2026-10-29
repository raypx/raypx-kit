import { defineConfig } from "vite-plus";
import { workspaceTaskConfig } from "../../scripts/tasks/config.js";

export default defineConfig({
  ...workspaceTaskConfig(import.meta.url),
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: { index: "src/index.ts", browser: "src/browser.ts", react: "src/react.tsx" },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    fixedExtension: true,
    target: "node22.21.0",
    deps: { neverBundle: [/^react(?:\/|$)/, /^posthog-js(?:\/|$)/] },
  },
});
