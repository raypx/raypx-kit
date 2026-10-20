import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: {
    index: "src/index.ts",
    postgres: "src/postgres.ts",
    errors: "src/errors.ts",
    results: "src/results.ts",
    diagnostics: "src/diagnostics.ts",
  },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.14.0",
  deps: { neverBundle: [/^drizzle-orm(?:\/|$)/, /^postgres(?:\/|$)/] },
});
