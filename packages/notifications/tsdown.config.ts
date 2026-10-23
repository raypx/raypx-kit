import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: { index: "src/index.ts", react: "src/react.tsx" },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
  deps: { neverBundle: [/^@knocklabs\//, /^react(?:\/|$)/, /^react-dom(?:\/|$)/] },
});
