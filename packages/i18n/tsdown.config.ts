import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["vite"],
  },
  {
    entry: ["src/runtime/index.ts"],
    outDir: "dist/runtime",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
  },
  {
    entry: ["src/vite.ts"],
    outDir: "dist/vite",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
  },
]);
