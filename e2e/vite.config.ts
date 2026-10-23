import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite-plus";
import repositoryConfig from "../vite.config.js";
import { browserProjects } from "./projects.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = new Set(
  Object.values(browserProjects)
    .filter((project) => project.port === 4173)
    .map((project) => `/${project.directory}/e2e/fixture/`),
);

function serverRenderedFixtures(): Plugin {
  return {
    name: "package-e2e-consumers",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname === "/__e2e_health") {
          response.writeHead(200, { "content-type": "text/plain" }).end("ready");
          return;
        }
        const directory = pathname.endsWith("index.html")
          ? pathname.slice(0, -"index.html".length)
          : pathname;
        if (!fixtures.has(directory)) return next();
        try {
          let html = await readFile(join(root, directory, "index.html"), "utf8");
          if (existsSync(join(root, directory, "server.tsx"))) {
            const entry = await server.ssrLoadModule(`${directory}server.tsx`);
            const rendered = (await entry.render()) as { body: string; head?: string };
            html = html
              .replace("<!--ssr-head-->", rendered.head ?? "")
              .replace("<!--ssr-body-->", rendered.body);
          }
          html = await server.transformIndexHtml(pathname, html);
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  // The post-build browser gate checks its own consumers with the same rules.
  lint: { ...repositoryConfig.lint, ignorePatterns: [] },
  root,
  plugins: [serverRenderedFixtures(), react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  resolve: { dedupe: ["react", "react-dom"] },
});
