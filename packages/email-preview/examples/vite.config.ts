import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { emailPreview } from "../src/index.js";
import type { InternalOptions } from "../src/server/plugin.js";

// Previews these examples with the package source and its built interface.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { tsconfigPaths: true },
  server: { host: "127.0.0.1", port: 3001, strictPort: true },
  plugins: [
    emailPreview({
      dir: ".",
      base: "/",
      interfaceDirectory: fileURLToPath(new URL("../dist/ui", import.meta.url)),
    } as InternalOptions),
  ],
});
