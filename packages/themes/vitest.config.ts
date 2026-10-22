import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "../../tests/config.js";

const shared = workspaceTests();
export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    environment: "jsdom",
    execArgv: [
      "--no-env-file",
      "--no-install",
      "--preload",
      fileURLToPath(new URL("../../tests/setup/jsdom-preload.ts", import.meta.url)),
    ],
  },
});
