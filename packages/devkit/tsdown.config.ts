import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: {
    workspaces: "src/workspaces.ts",
    architecture: "src/architecture.ts",
    toolchain: "src/toolchain.ts",
    process: "src/process.ts",
    artifact: "src/artifact.ts",
    catalogs: "src/catalogs.ts",
    docs: "src/docs.ts",
  },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
});
