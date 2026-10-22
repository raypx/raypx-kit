import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { context } from "esbuild";
import type { BuildContext, BuildResult } from "esbuild";
import { errorMessage, PreviewRuntimeError } from "./errors.js";

const runtimeRequire = createRequire(import.meta.url);

type Compilation = { code: string; error?: never } | { code?: never; error: PreviewRuntimeError };

export class TemplateCompiler {
  private buildContext: BuildContext | undefined;
  private compilation: Compilation | undefined;
  private closed = false;
  private readonly ready: Promise<void>;

  constructor(template: string, cwd: string, onChange: () => void) {
    this.ready = this.start(template, cwd, onChange);
  }

  private async start(template: string, cwd: string, onChange: () => void): Promise<void> {
    const consumerRequire = createRequire(template);
    try {
      for (const name of ["react", "react-dom"]) {
        const manifest = JSON.parse(
          await readFile(consumerRequire.resolve(`${name}/package.json`), "utf8"),
        ) as { version?: string };
        if (!manifest.version?.startsWith("19.")) {
          throw new Error(`Install ${name} 19 in the project containing your email templates.`);
        }
      }
    } catch (error) {
      this.compilation = {
        error: new PreviewRuntimeError("DEPENDENCY_ERROR", errorMessage(error), 422),
      };
      return;
    }
    let finishFirstBuild: (() => void) | undefined;
    const firstBuild = new Promise<void>((resolve) => {
      finishFirstBuild = resolve;
    });
    let first = true;
    const onEnd = (result: BuildResult) => {
      if (this.closed) return;
      const previous = this.compilation;
      const output = result.outputFiles?.find((file) => file.path.endsWith(".cjs"));
      if (result.errors.length > 0 || !output) {
        const message =
          result.errors
            .map((error) => {
              const location = error.location;
              return location
                ? `${relative(cwd, resolve(cwd, location.file))}:${location.line}: ${error.text}`
                : error.text;
            })
            .join("\n") || "The template could not be compiled.";
        this.compilation = { error: new PreviewRuntimeError("COMPILE_ERROR", message, 422) };
      } else {
        this.compilation = { code: output.text };
      }
      if (first) {
        first = false;
        finishFirstBuild?.();
      } else if (
        previous?.code !== this.compilation.code ||
        previous?.error?.message !== this.compilation.error?.message
      ) {
        onChange();
      }
    };
    try {
      this.buildContext = await context({
        absWorkingDir: cwd,
        stdin: {
          contents: `import { createElement } from "react";
import { pretty, render, toPlainText } from ${JSON.stringify(runtimeRequire.resolve("@react-email/render"))};
import * as email from ${JSON.stringify(template)};
export async function renderEmail() {
  const Component = email.default;
  if (!Component || (typeof Component !== "function" && typeof Component !== "object")) {
    throw new Error("The email template must default-export a React component.");
  }
  const html = await render(createElement(Component, Component.PreviewProps ?? {}));
  let formattedHtml = html;
  try {
    formattedHtml = await pretty(html);
  } catch {
    // Source formatting is optional; preview and text always use the original HTML.
  }
  return { html, formattedHtml, text: toPlainText(html) };
}`,
          resolveDir: dirname(template),
          sourcefile: "raypx-email-preview-entry.ts",
          loader: "ts",
        },
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node22.21",
        jsx: "automatic",
        write: false,
        metafile: true,
        outfile: "email.cjs",
        logLevel: "silent",
        plugins: [
          {
            name: "email-preview-runtime",
            setup(build) {
              build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
                path: consumerRequire.resolve(args.path),
                external: true,
              }));
              build.onEnd(onEnd);
            },
          },
        ],
      });
      if (this.closed) {
        await this.buildContext.dispose();
        return;
      }
      await this.buildContext.watch();
      await firstBuild;
    } catch (error) {
      this.compilation = {
        error: new PreviewRuntimeError("COMPILE_ERROR", errorMessage(error), 422),
      };
    }
  }

  async getCode(): Promise<string> {
    await this.ready;
    if (this.closed) throw new PreviewRuntimeError("CLOSED", "The preview server is closing.", 503);
    // A request immediately following a filesystem event must not race esbuild's
    // polling watcher. Identical rebuilds do not emit another change notification.
    await this.buildContext?.rebuild().catch(() => {});
    if (!this.compilation)
      throw new PreviewRuntimeError("COMPILE_ERROR", "Template compilation failed.", 422);
    if (this.compilation.error) throw this.compilation.error;
    return this.compilation.code;
  }

  async close(): Promise<void> {
    await this.ready;
    this.closed = true;
    await this.buildContext?.dispose();
  }
}
