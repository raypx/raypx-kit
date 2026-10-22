import { defineConfig } from "tsdown";
export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: { index: "src/index.ts", browser: "src/browser.ts", react: "src/react.tsx" },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.14.0",
  deps: { neverBundle: [/^react(?:\/|$)/, /^posthog-js(?:\/|$)/] },
});
