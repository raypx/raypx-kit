/**
 * Preview server for Nitro's Cloudflare prerender step.
 *
 * Nitro waits only ten seconds for the preview port and never stops the child when
 * that wait fails, so a slow Wrangler start under parallel builds both fails the
 * build and leaves Wrangler and workerd running. This wrapper binds the requested
 * port immediately, holds requests until Wrangler is ready, and stops Wrangler
 * when Nitro closes the preview or the build process exits.
 */
import { spawn } from "node:child_process";
import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";

const READY_TIMEOUT_MS = 120_000;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No free port")),
      );
    });
  });
}

function reachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

const publicPort = Number(option("--port") ?? process.env.PORT);
if (!Number.isInteger(publicPort)) throw new Error("Usage: preview.ts --port <port>");
const host = option("--host") ?? "localhost";
const internalPort = await freePort();
const parent = process.ppid;

const wrangler = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
    "dev",
    "--config",
    fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)),
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(internalPort),
  ],
  { stdio: "inherit", detached: true },
);

let stopping = false;
function stop(code = 0): void {
  if (stopping) return;
  stopping = true;
  // Wrangler starts workerd and esbuild; signal the whole process group.
  try {
    if (wrangler.pid) process.kill(-wrangler.pid, "SIGTERM");
  } catch {
    // Already exited.
  }
  server.close();
  process.exitCode = code;
  setTimeout(() => process.exit(code), 3000).unref();
}

const ready = (async () => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await reachable(internalPort)) return;
    if (wrangler.exitCode !== null) throw new Error("Wrangler exited before it was ready");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Wrangler was not ready within ${READY_TIMEOUT_MS} ms`);
})();
ready.catch((error: unknown) => {
  console.error(`[docs preview] ${error instanceof Error ? error.message : String(error)}`);
  stop(1);
});

async function proxy(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  try {
    await ready;
  } catch {
    outgoing.writeHead(503).end("Preview server unavailable");
    return;
  }
  const upstream = request(
    {
      host: "127.0.0.1",
      port: internalPort,
      method: incoming.method,
      path: incoming.url,
      headers: incoming.headers,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  upstream.once("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.pipe(upstream);
}

const server = createServer((incoming, outgoing) => void proxy(incoming, outgoing));
server.listen(publicPort, host);

wrangler.once("exit", (code) => stop(code ?? 1));
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.once(signal, () => stop());
// Nitro does not close the preview when prerendering fails; follow the build process.
setInterval(() => {
  try {
    process.kill(parent, 0);
  } catch {
    stop();
  }
  if (process.ppid !== parent) stop();
}, 1000).unref();
