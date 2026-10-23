import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";
import { resolveContainedFile } from "./discovery.js";
import { PreviewRuntimeError } from "./errors.js";
import type { PreviewRuntime } from "./runtime.js";

type Next = (error?: unknown) => void;

const noCache = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const interfaceTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function send(
  response: ServerResponse,
  status: number,
  headers: Record<string, string>,
  body?: string | Uint8Array,
) {
  response.writeHead(status, headers);
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  send(
    response,
    status,
    { ...noCache, "Content-Type": "application/json; charset=utf-8" },
    JSON.stringify(value),
  );
}

function sendError(response: ServerResponse, error: unknown) {
  const expected = error instanceof PreviewRuntimeError;
  sendJson(response, expected ? error.status : 500, {
    error: {
      code: expected ? error.code : "INTERNAL_ERROR",
      message: expected
        ? error.message
        : "The preview request failed. Try again after checking the template.",
    },
  });
}

function openEvents(runtime: PreviewRuntime, request: IncomingMessage, response: ServerResponse) {
  response.writeHead(200, {
    ...noCache,
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, revision: number) =>
    response.write(`event: ${event}\ndata: ${JSON.stringify({ revision })}\n\n`);
  const unsubscribe = runtime.subscribe((revision) => send("change", revision));
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15000);
  heartbeat.unref();
  let untrack = () => {};
  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
    untrack();
    if (!response.writableEnded) response.end();
  };
  untrack = runtime.trackStream(close);
  request.once("close", close);
  send("ready", runtime.revision);
}

/**
 * Serves the prebuilt interface and its API below `base`, which ends with a slash.
 * Requests outside `base` continue to the host server's own middleware.
 */
export function previewMiddleware(
  base: string,
  interfaceDirectory: string,
  getRuntime: () => Promise<PreviewRuntime>,
) {
  let indexHtml: Promise<string> | undefined;
  const readIndex = () =>
    (indexHtml ??= readFile(`${interfaceDirectory}/index.html`, "utf8").then(
      // Relative asset and API URLs resolve against the mount point.
      (html) => html.replace("<head>", `<head><base href="${base}" />`),
      () => {
        indexHtml = undefined;
        throw new PreviewRuntimeError(
          "NOT_FOUND",
          "The preview interface has not been built.",
          404,
        );
      },
    ));

  return async (request: IncomingMessage, response: ServerResponse, next: Next) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const mount = base.slice(0, -1);
    if (mount && url.pathname === mount) {
      send(response, 302, { Location: `${base}${url.search}` });
      return;
    }
    if (!url.pathname.startsWith(base)) return next();
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    const path = url.pathname.slice(base.length);
    try {
      if (path === "api/templates") {
        sendJson(response, 200, await (await getRuntime()).listTemplates());
      } else if (path === "api/preview") {
        const template = url.searchParams.get("template");
        if (!template) {
          throw new PreviewRuntimeError("INVALID_TEMPLATE", "Select an email template.", 400);
        }
        sendJson(response, 200, await (await getRuntime()).renderTemplate(template));
      } else if (path === "api/events") {
        openEvents(await getRuntime(), request, response);
      } else if (path.startsWith("static/")) {
        const file = await (await getRuntime()).getStaticFile(decodeURIComponent(path.slice(7)));
        send(
          response,
          200,
          { ...noCache, "Content-Type": file.contentType, "Content-Security-Policy": "sandbox" },
          file.data,
        );
      } else if (path === "" || path === "index.html") {
        send(
          response,
          200,
          { ...noCache, "Content-Type": interfaceTypes[".html"]! },
          await readIndex(),
        );
      } else if (path.startsWith("assets/")) {
        const file = await resolveContainedFile(interfaceDirectory, path).catch(() => undefined);
        // Unknown paths belong to the host server, which matters when `base` is `/`.
        if (!file) return next();
        send(
          response,
          200,
          {
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Type": interfaceTypes[extname(file)] ?? "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
          },
          await readFile(file),
        );
      } else {
        return next();
      }
    } catch (error) {
      if (response.headersSent) response.destroy();
      else sendError(response, error);
    }
  };
}
