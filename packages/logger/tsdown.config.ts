import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: {
    index: "src/index.ts",
    context: "src/context.ts",
    pipeline: "src/pipeline.ts",
    safe: "src/safe.ts",
    stream: "src/stream.ts",
  },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
  deps: { neverBundle: [/^evlog(?:\/|$)/] },
});
