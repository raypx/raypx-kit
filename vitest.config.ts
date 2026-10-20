import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "./tests/config.js";

const config = workspaceTests();
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "docs/tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
