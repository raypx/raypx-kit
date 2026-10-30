import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { remarkDirectiveAdmonition, remarkMdxFiles, remarkSteps } from "fumadocs-core/mdx-plugins";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import remarkDirective from "remark-directive";
import { defineConfig, loadEnv } from "vite-plus";
import { startEnvironment } from "../packages/devkit/src/vite.js";
import { documentationPages, getContentUrl, getDocumentationPath } from "./src/lib/pages";
import { localeConfig } from "./src/lib/i18n/config";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const cloudflare = process.env.TOOLKIT_DOCS_PRESET === "cloudflare_module";
const documentationPaths = localeConfig.locales.flatMap((locale) =>
  documentationPages.map((page) => getDocumentationPath(page.slug, locale)),
);

type MarkdownNode = {
  type: string;
  depth?: number;
  url?: string;
  children?: MarkdownNode[];
};

// Numbered inventory headings are sections, so step rendering is opt-in per page.
function remarkDocumentationSteps() {
  const transform = remarkSteps();
  return (...args: Parameters<typeof transform>) => {
    const frontmatter = args[1].data.frontmatter;
    if (
      frontmatter &&
      typeof frontmatter === "object" &&
      "steps" in frontmatter &&
      frontmatter.steps === true
    )
      return transform(...args);
  };
}

export default defineConfig(({ command }) => ({
  server: { port: 3100, strictPort: true },
  // Keep the preview listener and prerender fetches on the same IPv4 loopback.
  preview: { host: "127.0.0.1" },
  resolve: { dedupe: ["react", "react-dom"] },
  // Bundle server dependencies; development uses native CJS interop.
  ssr: { noExternal: command === "build" ? true : [] },
  plugins: [
    nitro({
      preset: command === "serve" || !cloudflare ? "bun" : "cloudflare_module",
      cloudflare: { deployConfig: false },
      commands: {
        // Wraps Wrangler so a slow start or failed prerender cannot orphan workerd.
        preview: `${cloudflare ? "node" : "bun"} scripts/preview.ts`,
      },
      serverDir: false,
      serverEntry: false,
    }),
    fumadocsMdx({
      index: false,
      macro: { include: ["src/lib/source.ts"] },
      globalOptions: {
        mdxOptions: {
          remarkPlugins: (defaults) => [
            () => (tree: MarkdownNode, file: { path: string }) => {
              const sourcePath = relative(repositoryRoot, file.path).replaceAll("\\", "/");
              const heading = tree.children?.[0];
              if (heading?.type === "heading" && heading.depth === 1) tree.children?.shift();

              function rewriteLinks(node: MarkdownNode) {
                if ((node.type === "link" || node.type === "definition") && node.url) {
                  node.url = getContentUrl(node.url, sourcePath);
                }
                node.children?.forEach(rewriteLinks);
              }
              rewriteLinks(tree);
            },
            remarkDirective,
            remarkDirectiveAdmonition,
            remarkMdxFiles,
            remarkDocumentationSteps,
            ...defaults,
          ],
        },
      },
    }),
    tailwindcss(),
    startEnvironment(
      tanstackStart({
        prerender: {
          enabled: true,
          concurrency: 2,
          autoStaticPathsDiscovery: false,
          crawlLinks: false,
          failOnError: true,
        },
        pages: ["/", "/zh", ...documentationPaths].map((path) => ({ path })),
        sitemap: { enabled: false },
      }),
      loadEnv,
    ),
    react(),
  ],
}));
