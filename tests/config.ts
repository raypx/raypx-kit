import { defineConfig } from "vite-plus/test/config";

/** Library tests have no Raypx application plugins or runtime preloads. */
export function workspaceTests() {
  return defineConfig({
    test: {
      environment: "node",
      maxWorkers: 2,
      execArgv: ["--no-env-file", "--no-install"],
      include: ["tests/**/*.{test,spec}.{ts,tsx}"],
      reporters: [
        "default",
        ["junit", { outputFile: ".artifacts/junit.xml", includeConsoleOutput: false }],
      ],
      coverage: { reporter: ["text", "json", "lcov"] },
    },
  });
}
