import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: { index: "src/index.ts", config: "src/config.ts", script: "src/script.ts" },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
  deps: { neverBundle: [/^react(?:\/|$)/] },
});
