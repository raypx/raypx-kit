import { defineConfig } from "vite-plus/test/config";

/** Library tests have no Raypx application plugins or runtime preloads. */
export function workspaceTests() {
  return defineConfig({
    test: {
      environment: "node",
      // Turbo owns workspace parallelism; keep one worker per active test task.
      maxWorkers: 1,
      execArgv: ["--no-env-file", "--no-install"],
      include: ["tests/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["**/e2e/**"],
      reporters: [
        "default",
        ["junit", { outputFile: ".artifacts/junit.xml", includeConsoleOutput: false }],
      ],
      coverage: { reporter: ["text", "json", "lcov"] },
    },
  });
}
