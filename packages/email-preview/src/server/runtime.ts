import { statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { isRunnableDevEnvironment } from "vite";
import type { RunnableDevEnvironment, ViteDevServer } from "vite";
import type { PreviewResult, TemplateList } from "../types.js";
import {
  discoverTemplates,
  isContained,
  resolveContainedFile,
  resolveDirectory,
} from "./discovery.js";
import { errorMessage, PreviewRuntimeError } from "./errors.js";
import { formatHtml } from "./format.js";
import { assertReact, environmentName, renderEntryId } from "./render.js";
import { readStaticFile } from "./static.js";

export interface RuntimeOptions {
  /** Template directory, relative to the Vite root unless absolute. */
  directory: string;
  renderTimeoutMs: number;
  /**
   * Vite's watcher drops a second change to the same file within 50 ms, which would
   * leave a failed render cached until an unrelated edit. Each changed file is compared
   * again after this window. Defaults to 75 ms; tests widen it.
   */
  missedChangeWindowMs?: number;
}

type RenderedEmail = Pick<PreviewResult, "html" | "text">;

function fileSignature(path: string): string {
  const stats = statSync(path, { throwIfNoEntry: false });
  return stats ? `${stats.mtimeMs}:${stats.size}` : "missing";
}

function isRenderedEmail(value: unknown): value is RenderedEmail {
  return (
    typeof value === "object" &&
    value !== null &&
    "html" in value &&
    typeof value.html === "string" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export class PreviewRuntime {
  private readonly listeners = new Set<(revision: number) => void>();
  private readonly streams = new Set<() => void>();
  private readonly rechecks = new Map<string, ReturnType<typeof setTimeout>>();
  private notification: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private currentRevision = 0;

  private constructor(
    private readonly server: ViteDevServer,
    readonly directory: string,
    private readonly timeoutMs: number,
    private readonly recheckMs: number,
  ) {}

  static async create(server: ViteDevServer, options: RuntimeOptions): Promise<PreviewRuntime> {
    if (!Number.isFinite(options.renderTimeoutMs) || options.renderTimeoutMs < 1) {
      throw new PreviewRuntimeError(
        "INVALID_OPTIONS",
        "renderTimeoutMs must be a positive number.",
        400,
      );
    }
    const directory = await resolveDirectory(server.config.root, options.directory);
    const runtime = new PreviewRuntime(
      server,
      directory,
      options.renderTimeoutMs,
      options.missedChangeWindowMs ?? 75,
    );
    // The template directory may sit outside the Vite root, for example in a sibling package.
    server.watcher.add(directory);
    server.watcher.on("all", runtime.onFileEvent);
    return runtime;
  }

  private get environment(): RunnableDevEnvironment {
    const environment = this.server.environments[environmentName];
    if (!environment || !isRunnableDevEnvironment(environment)) {
      throw new PreviewRuntimeError(
        "NOT_INITIALIZED",
        "The email preview environment is not available.",
        503,
      );
    }
    return environment;
  }

  private readonly onFileEvent = (_event: string, file: string): void => {
    const path = resolve(file);
    const environment = this.server.environments[environmentName];
    if (
      !isContained(this.directory, path) &&
      basename(path) !== "tsconfig.json" &&
      !environment?.moduleGraph.getModulesByFile(path)?.size
    ) {
      return;
    }
    this.refresh();
    const seen = fileSignature(path);
    clearTimeout(this.rechecks.get(path));
    this.rechecks.set(
      path,
      setTimeout(() => {
        this.rechecks.delete(path);
        if (!this.closed && fileSignature(path) !== seen) this.refresh();
      }, this.recheckMs),
    );
  };

  private refresh(): void {
    // Vite invalidates changed modules asynchronously. Template graphs are small,
    // so drop them now and the next render can never observe stale code.
    const environment = this.server.environments[environmentName];
    if (environment && isRunnableDevEnvironment(environment)) {
      environment.moduleGraph.invalidateAll();
      environment.runner.clearCache();
    }
    this.invalidate();
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
    try {
      await assertReact(path);
    } catch (error) {
      throw new PreviewRuntimeError("DEPENDENCY_ERROR", errorMessage(error), 422);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.assertOpen();
      const revision = this.revision;
      const result = await this.render(path);
      if (this.revision === revision) {
        return { id, revision, ...result, formattedHtml: await formatHtml(result.html) };
      }
    }
    throw new PreviewRuntimeError(
      "TEMPLATE_CHANGED",
      "The template changed while rendering. Please try again.",
      409,
    );
  }

  private async render(path: string): Promise<RenderedEmail> {
    let entry: { renderEmail?: unknown };
    try {
      entry = await this.withTimeout(this.environment.runner.import(renderEntryId(path)));
    } catch (error) {
      if (error instanceof PreviewRuntimeError) throw error;
      throw new PreviewRuntimeError("COMPILE_ERROR", errorMessage(error), 422);
    }
    try {
      if (typeof entry.renderEmail !== "function") throw new Error("Rendering failed to load.");
      const value: unknown = await this.withTimeout(Promise.resolve(entry.renderEmail()));
      if (!isRenderedEmail(value)) throw new Error("The template returned an invalid result.");
      return value;
    } catch (error) {
      if (error instanceof PreviewRuntimeError) throw error;
      throw new PreviewRuntimeError("RENDER_ERROR", errorMessage(error), 422);
    }
  }

  /**
   * Templates run in the dev server process. A timeout reports work that never
   * settles; it cannot interrupt a synchronous loop.
   */
  private withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new PreviewRuntimeError(
              "RENDER_TIMEOUT",
              `Template rendering exceeded ${this.timeoutMs} ms.`,
              422,
            ),
          ),
        this.timeoutMs,
      );
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  }

  subscribe(listener: (revision: number) => void): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Registers an open event stream so shutdown can end it. */
  trackStream(close: () => void): () => void {
    this.streams.add(close);
    return () => this.streams.delete(close);
  }

  async getStaticFile(
    path: string,
  ): Promise<{ data: Uint8Array<ArrayBuffer>; contentType: string }> {
    this.assertOpen();
    return readStaticFile(this.directory, path);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.notification) clearTimeout(this.notification);
    for (const timer of this.rechecks.values()) clearTimeout(timer);
    this.rechecks.clear();
    this.server.watcher.off("all", this.onFileEvent);
    for (const close of this.streams) close();
    this.streams.clear();
    this.listeners.clear();
  }
}
