import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "../../tests/config.js";

export default defineConfig(workspaceTests());
