import "@tanstack/react-start/server-only";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import type { PreviewOptions, PreviewResult, TemplateList } from "../types.js";
import { TemplateCompiler } from "./compiler.js";
import { discoverTemplates, resolveContainedFile, resolveDirectory } from "./discovery.js";
import { PreviewRuntimeError } from "./errors.js";
import { readStaticFile } from "./static.js";
import { RenderWorkers } from "./worker.js";

export class PreviewRuntime {
  private readonly compilers = new Map<string, TemplateCompiler>();
  private readonly listeners = new Set<(revision: number) => void>();
  private watcher: FSWatcher | undefined;
  private notification: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private currentRevision = 0;
  private readonly workers: RenderWorkers;

  private constructor(
    private readonly cwd: string,
    private readonly directory: string,
    private readonly temporaryDirectory: string,
    timeoutMs: number,
  ) {
    this.workers = new RenderWorkers(temporaryDirectory, timeoutMs);
  }

  static async create(options: PreviewOptions): Promise<PreviewRuntime> {
    const cwd = await realpath(options.cwd);
    const directory = await resolveDirectory(cwd, options.directory);
    const timeout = options.renderTimeoutMs ?? 10_000;
    if (!Number.isFinite(timeout) || timeout < 1) {
      throw new PreviewRuntimeError(
        "INVALID_OPTIONS",
        "renderTimeoutMs must be a positive number.",
        400,
      );
    }
    const temporaryDirectory = await realpath(
      await mkdtemp(join(tmpdir(), "raypx-email-preview-")),
    );
    const runtime = new PreviewRuntime(cwd, directory, temporaryDirectory, timeout);
    try {
      const watchedPaths = new Set([directory, join(cwd, "tsconfig.json")]);
      for (const start of [directory, cwd]) {
        for (let ancestor = start; ; ancestor = dirname(ancestor)) {
          const config = join(ancestor, "tsconfig.json");
          if (
            await stat(config).then(
              (value) => value.isFile(),
              () => false,
            )
          ) {
            watchedPaths.add(config);
            break;
          }
          if (dirname(ancestor) === ancestor) break;
        }
      }
      runtime.watcher = watch([...watchedPaths], {
        ignoreInitial: true,
        followSymlinks: false,
        ignored: /(^|[/\\])(node_modules|\.git)([/\\]|$)/,
        awaitWriteFinish: { stabilityThreshold: 60, pollInterval: 20 },
      });
      runtime.watcher.on("all", () => runtime.invalidate());
      await new Promise<void>((resolve, reject) => {
        runtime.watcher?.once("ready", resolve);
        runtime.watcher?.once("error", reject);
      });
      return runtime;
    } catch (error) {
      await runtime.close();
      throw error;
    }
  }

  get revision(): number {
    return this.currentRevision;
  }

  private invalidate(): void {
    if (this.closed) return;
    this.currentRevision += 1;
    if (this.notification) clearTimeout(this.notification);
    this.notification = setTimeout(() => {
      this.notification = undefined;
      for (const listener of this.listeners) {
        try {
          listener(this.currentRevision);
        } catch {
          this.listeners.delete(listener);
        }
      }
    }, 80);
  }

  private assertOpen(): void {
    if (this.closed) throw new PreviewRuntimeError("CLOSED", "The preview server is closing.", 503);
  }

  async listTemplates(): Promise<TemplateList> {
    this.assertOpen();
    return {
      directory: this.directory,
      templates: await discoverTemplates(this.directory),
      revision: this.revision,
    };
  }

  async renderTemplate(id: string): Promise<PreviewResult> {
    this.assertOpen();
    const { templates } = await this.listTemplates();
    if (!templates.some((template) => template.id === id)) {
      throw new PreviewRuntimeError("TEMPLATE_NOT_FOUND", "Email template not found.", 404);
    }
    const path = await resolveContainedFile(this.directory, id);
    let compiler = this.compilers.get(id);
    if (!compiler) {
      compiler = new TemplateCompiler(path, this.cwd, () => this.invalidate());
      this.compilers.set(id, compiler);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.assertOpen();
      const code = await compiler.getCode();
      const revision = this.revision;
      const result = await this.workers.render(code);
      if (this.revision === revision) return { id, revision, ...result };
    }
    throw new PreviewRuntimeError(
      "TEMPLATE_CHANGED",
      "The template changed while rendering. Please try again.",
      409,
    );
  }

  subscribe(listener: (revision: number) => void): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getStaticFile(path: string): Promise<{ data: Uint8Array; contentType: string }> {
    this.assertOpen();
    return readStaticFile(this.directory, path);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.notification) clearTimeout(this.notification);
    this.listeners.clear();
    await this.watcher?.close();
    await this.workers.close();
    await Promise.all([...this.compilers.values()].map((compiler) => compiler.close()));
    this.compilers.clear();
    await rm(this.temporaryDirectory, { recursive: true, force: true });
  }
}

let runtime: PreviewRuntime | undefined;

export async function initializePreview(options: PreviewOptions): Promise<void> {
  if (runtime)
    throw new PreviewRuntimeError(
      "ALREADY_INITIALIZED",
      "The preview server is already initialized.",
      409,
    );
  runtime = await PreviewRuntime.create(options);
}

export function getPreviewRuntime(): PreviewRuntime {
  if (!runtime)
    throw new PreviewRuntimeError(
      "NOT_INITIALIZED",
      "The preview server has not been initialized.",
      503,
    );
  return runtime;
}

export async function closePreview(): Promise<void> {
  const current = runtime;
  runtime = undefined;
  await current?.close();
}
