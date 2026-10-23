import { fileURLToPath } from "node:url";
import { createRunnableDevEnvironment } from "vite";
import type { Plugin } from "vite";
import { previewMiddleware } from "./middleware.js";
import { environmentName, loadRenderEntry, resolveRenderEntry } from "./render.js";
import { PreviewRuntime } from "./runtime.js";

export interface EmailPreviewOptions {
  /** Template directory relative to the Vite root. Defaults to `emails`. */
  dir?: string;
  /** URL prefix for the interface and its API. Defaults to `/__email`. */
  base?: string;
  /** Rendering timeout in milliseconds. Defaults to 10000. */
  renderTimeoutMs?: number;
}

/** @internal Lets source tests and the package's own development serve another build. */
export interface InternalOptions extends EmailPreviewOptions {
  interfaceDirectory?: string;
}

function normalizeBase(base: string): string {
  const value = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  if (!/^\/(?:[\w.-]+\/)*$/.test(value)) {
    throw new Error(`Invalid email preview base: ${base}`);
  }
  return value;
}

/** Adds the React Email preview to a Vite dev server. Builds are unaffected. */
export function emailPreview(options: EmailPreviewOptions = {}): Plugin {
  const {
    dir = "emails",
    renderTimeoutMs = 10_000,
    interfaceDirectory = fileURLToPath(new URL("./ui", import.meta.url)),
  } = options as InternalOptions;
  const base = normalizeBase(options.base ?? "/__email");
  let runtime: Promise<PreviewRuntime> | undefined;

  return {
    name: "raypx-email-preview",
    apply: "serve",
    // Lets tests and cooperating plugins reach the running preview.
    api: { runtime: () => runtime },
    config() {
      return {
        environments: {
          // Templates get their own module graph, so rendering never loads into or
          // invalidates the application's SSR environment.
          [environmentName]: {
            consumer: "server",
            resolve: {
              dedupe: ["react", "react-dom"],
              external: true,
              // Bundled through Vite so the renderer resolves the project's React.
              noExternal: ["@react-email/render"],
            },
            dev: {
              createEnvironment: (name, config) => createRunnableDevEnvironment(name, config),
            },
          },
        },
      };
    },
    resolveId(id) {
      return resolveRenderEntry(id);
    },
    load(id) {
      return loadRenderEntry(id);
    },
    configureServer(server) {
      runtime = PreviewRuntime.create(server, { directory: dir, renderTimeoutMs });
      // Keep a failed start observable through each request instead of crashing.
      runtime.catch(() => {});
      server.middlewares.use(previewMiddleware(base, interfaceDirectory, () => runtime!));
      server.httpServer?.once("close", () => void runtime?.then((value) => value.close()));
    },
    async buildEnd() {
      (await runtime?.catch(() => undefined))?.close();
    },
  };
}
