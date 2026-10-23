import { fileURLToPath } from "node:url";
import { createThemeScript } from "@raypx-kit/themes/script";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { licenseNotices } from "./build/license-notices.js";
import { themeStorageKey } from "./src/ui/lib/preview.js";

const notices = licenseNotices(
  fileURLToPath(new URL("./dist/THIRD_PARTY_LICENSES.txt", import.meta.url)),
  [
    // Expanded from ui/styles.css and the shared UI stylesheet, respectively.
    { name: "tailwindcss", importer: import.meta.url },
    { name: "tw-animate-css", importer: import.meta.resolve("@raypx-kit/ui/styles.css") },
  ],
);

// Builds the static interface that the plugin serves; consumers never build it.
export default defineConfig({
  root: fileURLToPath(new URL("./src/ui", import.meta.url)),
  // Relative URLs keep the interface working below any mount point, such as /__email/.
  base: "./",
  plugins: [
    notices,
    tailwindcss(),
    react(),
    {
      name: "theme-script",
      transformIndexHtml: () => [
        {
          tag: "script",
          children: createThemeScript({ storageKey: themeStorageKey }),
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    outDir: fileURLToPath(new URL("./dist/ui", import.meta.url)),
    emptyOutDir: true,
  },
});
