import { mergeConfig } from "vite-plus";
import { workspaceTests } from "../../tests/config.js";

export default mergeConfig(workspaceTests(), {
  test: { testTimeout: 20000 },
});
