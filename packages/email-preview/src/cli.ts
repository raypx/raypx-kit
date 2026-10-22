#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PreviewOptions } from "./types.js";

interface PreviewEntry {
  initializePreview(options: PreviewOptions): Promise<void>;
  closePreview(): Promise<void>;
  middleware(request: IncomingMessage, response: ServerResponse): void | Promise<void>;
}

const help = `Usage: raypx-email dev [--dir <directory>] [--port <port>]

Preview React Email templates with TanStack Start.

Commands:
  dev                Watch and preview local email templates

Options:
  --dir <directory>  Template directory relative to the current project (default: emails)
  --port <port>      Local HTTP port (default: 3001)
  --help, -h         Show this help
  --version, -v      Show the installed version

The server listens on 127.0.0.1. Templates execute as local project code.
`;

async function main(args: string[]) {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    process.stdout.write(help);
    return;
  }
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    const manifest: { version: string } = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    process.stdout.write(`${manifest.version}\n`);
    return;
  }
  if (args.shift() !== "dev") throw new Error("Unknown command. Run raypx-email --help for usage.");
  let directory = "emails";
  let port = 3001;
  while (args.length) {
    const flag = args.shift();
    if (flag !== "--dir" && flag !== "--port") throw new Error(`Unknown option: ${flag}`);
    const value = args.shift();
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    if (flag === "--dir") directory = value;
    else {
      if (!/^\d+$/.test(value) || Number(value) > 65535) {
        throw new Error("--port must be an integer between 0 and 65535.");
      }
      port = Number(value);
    }
  }

  const entryUrl = new URL("./app/server/index.mjs", import.meta.url).href;
  const entry = (await import(/* @vite-ignore */ entryUrl)) as PreviewEntry;
  const server = createServer((request, response) => {
    Promise.resolve()
      .then(() => entry.middleware(request, response))
      .catch(() => {
        if (response.headersSent) response.destroy();
        else {
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.end("The preview server could not handle this request.");
        }
      });
  });
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      await entry.closePreview();
      await new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      });
    })();
    return closing;
  };
  const onSignal = () => {
    void close().catch((error: unknown) => {
      process.stderr.write(`Could not close email preview: ${message(error)}\n`);
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    await entry.initializePreview({ cwd: process.cwd(), directory: resolve(directory) });
    if (closing) {
      // A signal may arrive while the directory watcher is still initializing.
      await entry.closePreview();
      return;
    }
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        done();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No listening address was created.");
    process.stdout.write(
      `Email preview: http://127.0.0.1:${address.port}\nTemplates: ${resolve(directory)}\n`,
    );
  } catch (error) {
    await close();
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new Error(`Port ${port} is already in use. Choose another port with --port.`, {
        cause: error,
      });
    }
    throw error;
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${message(error)}\n`);
  process.exitCode = 1;
});
