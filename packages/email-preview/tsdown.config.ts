import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: { cli: "src/cli.ts", runtime: "src/http/runtime.ts" },
  deps: { alwaysBundle: ["@tanstack/react-start/server-only"] },
  dts: false,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
});
