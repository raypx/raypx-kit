import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: { index: "src/index.ts", runtime: "src/runtime.ts" },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.14.0",
  deps: { neverBundle: [/^zod(?:\/|$)/] },
});
