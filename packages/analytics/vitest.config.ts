import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "../../tests/config.js";
const shared = workspaceTests();
export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    environment: "jsdom",
  },
});
