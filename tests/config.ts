import { defineConfig, mergeConfig } from "vite-plus/test/config";
import { bunTestDefaults } from "../packages/devkit/src/testing.js";

/** Library tests have no Raypx application plugins or runtime preloads. */
export function workspaceTests() {
  return mergeConfig(
    bunTestDefaults,
    defineConfig({
      test: {
        include: ["tests/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["**/e2e/**"],
        reporters: [
          "default",
          ["junit", { outputFile: ".artifacts/junit.xml", includeConsoleOutput: false }],
        ],
      },
    }),
  );
}
