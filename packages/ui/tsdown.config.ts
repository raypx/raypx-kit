import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.build.json",
  entry: {
    index: "src/index.ts",
    "components/ui/button": "src/components/ui/button.tsx",
    "components/ui/input": "src/components/ui/input.tsx",
    "components/ui/tabs": "src/components/ui/tabs.tsx",
    "components/ui/badge": "src/components/ui/badge.tsx",
    "components/ui/dialog": "src/components/ui/dialog.tsx",
    "components/ui/skeleton": "src/components/ui/skeleton.tsx",
    "components/ui/native-select": "src/components/ui/native-select.tsx",
    "lib/utils": "src/lib/utils.ts",
  },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  fixedExtension: true,
  target: "node22.21.0",
  deps: {
    neverBundle: [
      /^react(?:-dom)?(?:\/|$)/,
      /^@base-ui\//,
      /^lucide-react(?:\/|$)/,
      /^class-variance-authority$/,
      /^cn$/,
    ],
  },
  banner: ({ fileName }) =>
    fileName.endsWith(".mjs") && (fileName === "index.mjs" || fileName.startsWith("components/ui/"))
      ? '"use client";'
      : undefined,
});
