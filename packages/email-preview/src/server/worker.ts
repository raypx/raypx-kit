import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { PreviewResult } from "../types.js";
import { errorMessage, PreviewRuntimeError } from "./errors.js";

// Kept inline so a published/bundled server needs no additional worker asset.
const workerSource = `const { parentPort, workerData } = require("node:worker_threads");
const { createRequire } = require("node:module");
Promise.resolve().then(() => createRequire(workerData.path)(workerData.path).renderEmail()).then(
  value => parentPort.postMessage({ ok: true, value }),
  error => parentPort.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) })
);`;

type RenderedEmail = Pick<PreviewResult, "html" | "formattedHtml" | "text">;

function isRenderedEmail(value: unknown): value is RenderedEmail {
  return (
    typeof value === "object" &&
    value !== null &&
    "html" in value &&
    typeof value.html === "string" &&
    "formattedHtml" in value &&
    typeof value.formattedHtml === "string" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export class RenderWorkers {
  private readonly workers = new Set<Worker>();
  private closed = false;

  constructor(
    private readonly temporaryDirectory: string,
    private readonly timeoutMs: number,
  ) {}

  async render(code: string): Promise<RenderedEmail> {
    if (this.closed) throw new PreviewRuntimeError("CLOSED", "The preview server is closing.", 503);
    const path = join(this.temporaryDirectory, `${randomUUID()}.cjs`);
    await writeFile(path, code, { mode: 0o600 });
    try {
      if (this.closed)
        throw new PreviewRuntimeError("CLOSED", "The preview server is closing.", 503);
      const worker = new Worker(workerSource, { eval: true, workerData: { path } });
      this.workers.add(worker);
      try {
        return await new Promise<RenderedEmail>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(
              new PreviewRuntimeError(
                "RENDER_TIMEOUT",
                `Template rendering exceeded ${this.timeoutMs} ms.`,
                422,
              ),
            );
            void worker.terminate();
          }, this.timeoutMs);
          const finish = (error?: PreviewRuntimeError, value?: RenderedEmail) => {
            clearTimeout(timer);
            if (error) reject(error);
            else if (value) resolve(value);
          };
          worker.once("message", (message: unknown) => {
            if (typeof message !== "object" || message === null) {
              finish(
                new PreviewRuntimeError(
                  "RENDER_ERROR",
                  "The template returned an invalid result.",
                  422,
                ),
              );
            } else if (
              "ok" in message &&
              message.ok === true &&
              "value" in message &&
              isRenderedEmail(message.value)
            ) {
              finish(undefined, message.value);
            } else {
              finish(
                new PreviewRuntimeError(
                  "RENDER_ERROR",
                  "message" in message && typeof message.message === "string"
                    ? message.message
                    : "The template could not be rendered.",
                  422,
                ),
              );
            }
          });
          worker.once("error", (error) =>
            finish(new PreviewRuntimeError("RENDER_ERROR", errorMessage(error), 422)),
          );
          worker.once("exit", () =>
            finish(
              new PreviewRuntimeError(
                "RENDER_ERROR",
                "The template worker exited before completing.",
                422,
              ),
            ),
          );
        });
      } finally {
        this.workers.delete(worker);
        await worker.terminate();
      }
    } finally {
      await unlink(path).catch(() => {});
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.workers].map((worker) => worker.terminate()));
    this.workers.clear();
  }
}
