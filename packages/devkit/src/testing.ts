import type { ViteUserConfig } from "vite-plus";

/** Plain Vitest defaults for Bun workers; consumers own suites, setup and environments. */
export const bunTestDefaults = {
  test: {
    environment: "node",
    maxWorkers: 1,
    execArgv: ["--no-env-file", "--no-install"],
    coverage: { provider: "v8", reporter: ["text", "json", "lcov"] },
  },
} satisfies ViteUserConfig;
