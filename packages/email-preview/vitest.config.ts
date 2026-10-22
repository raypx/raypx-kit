import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite-plus";
import { workspaceTests } from "../../tests/config.js";

export default mergeConfig(workspaceTests(), {
  resolve: {
    alias: {
      "@tanstack/react-start/server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: { testTimeout: 20000 },
});
