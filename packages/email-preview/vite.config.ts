import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { licenseNotices } from "./build/license-notices.js";

const notices = licenseNotices(
  fileURLToPath(new URL("./dist/THIRD_PARTY_LICENSES.txt", import.meta.url)),
  [
    // Expanded from app/styles.css and the shared UI stylesheet, respectively.
    { name: "tailwindcss", importer: import.meta.url },
    { name: "tw-animate-css", importer: import.meta.resolve("@raypx-kit/ui/styles.css") },
  ],
);

export default defineConfig({
  plugins: [
    notices,
    tailwindcss(),
    {
      name: "shared-preview-runtime",
      enforce: "pre",
      resolveId(id) {
        if (id === "#preview-runtime") return { id, external: true };
      },
    },
    nitro({
      preset: "node-middleware",
      entry: fileURLToPath(new URL("./src/http/entry.ts", import.meta.url)),
      serverDir: false,
      serverEntry: false,
      serveStatic: true,
      noExternals: true,
      rolldownConfig: {
        plugins: [notices],
        external: ["#preview-runtime"],
        onLog(level, log, handler) {
          // The app uses standard SSR, so React's RSC directives do not apply.
          if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
        },
      },
      output: { dir: fileURLToPath(new URL("./dist/app", import.meta.url)) },
    }),
    tanstackStart({ srcDirectory: "src/app" }),
    react(),
  ],
  resolve: { dedupe: ["react", "react-dom"] },
  ssr: { external: ["#preview-runtime"] },
  server: { port: 3001, strictPort: true },
});
