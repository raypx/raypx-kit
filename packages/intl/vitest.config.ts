import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";

import { workspaceTests } from "../../tests/config.js";

const shared = workspaceTests();

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    // Project discovery is explicit; do not merge the root's broad pattern into both environments.
    include: [],
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["tests/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["tests/react/**"],
          execArgv: ["--no-env-file", "--no-install"],
        },
      },
      {
        test: {
          name: "react",
          environment: "jsdom",
          include: ["tests/react/**/*.{test,spec}.{ts,tsx}"],
          execArgv: [
            "--no-env-file",
            "--no-install",
            "--preload",
            fileURLToPath(new URL("../../tests/setup/jsdom-preload.ts", import.meta.url)),
          ],
        },
      },
    ],
  },
});
