import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "../../test.config.js";

const config = workspaceTests();

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["tests/integration/**/*.integration.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
