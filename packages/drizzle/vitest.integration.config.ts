import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "../../tests/config.js";

// Reject test runs before Vite loads database suites; analysis tools may inspect this config.
if (process.env.VITEST === "true") {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("Drizzle integration tests run only in GitHub Actions.");
  if (!process.env.DRIZZLE_TEST_DATABASE_URL?.trim())
    throw new Error("DRIZZLE_TEST_DATABASE_URL is required for Drizzle integration tests.");
}

const config = workspaceTests();

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["tests/integration/**/*.integration.test.ts"],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
