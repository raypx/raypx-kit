/**
 * Preview server for Nitro's Bun and Cloudflare prerender steps.
 *
 * Nitro waits only ten seconds for the preview port and never stops the child when
 * that wait fails, so a slow Wrangler start under parallel builds both fails the
 * build and leaves Wrangler and workerd running. This wrapper binds the requested
 * port immediately, holds requests until Wrangler is ready, and stops Wrangler
 * when Nitro closes the preview or the build process exits.
 */
import { spawn } from "node:child_process";
import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createNetServer } from "node:net";
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

async function reachable(port: number): Promise<boolean> {
  try {
    // Wrangler binds before its Worker is ready and returns temporary 503s.
    const response = await fetch(`http://127.0.0.1:${port}/docs`, {
      redirect: "manual",
      signal: AbortSignal.timeout(2000),
    });
    await response.body?.cancel();
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

const publicPort = Number(option("--port") ?? process.env.PORT);
if (!Number.isInteger(publicPort)) throw new Error("Usage: preview.ts --port <port>");
const host = option("--host") ?? "127.0.0.1";
const internalPort = await freePort();
const parent = process.ppid;

const cloudflare = process.env.TOOLKIT_DOCS_PRESET === "cloudflare_module";
const runtime = spawn(
  process.execPath,
  cloudflare
    ? [
        fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
        "dev",
        "--config",
        fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)),
        "--local",
        "--ip",
        "127.0.0.1",
        "--port",
        String(internalPort),
      ]
    : [fileURLToPath(new URL("../.output/server/index.mjs", import.meta.url))],
  {
    stdio: "inherit",
    detached: true,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(internalPort) },
  },
);

let stopping = false;
function stop(code = 0): void {
  if (stopping) return;
  stopping = true;
  // Wrangler starts workerd and esbuild; signal the whole process group.
  try {
    if (runtime.pid) process.kill(-runtime.pid, "SIGTERM");
  } catch {
    // Already exited.
  }
  for (const server of servers) server.close();
  process.exitCode = code;
  setTimeout(() => process.exit(code), 3000).unref();
}

const ready = (async () => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await reachable(internalPort)) return;
    if (runtime.exitCode !== null) throw new Error("Preview runtime exited before it was ready");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview runtime was not ready within ${READY_TIMEOUT_MS} ms`);
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

// Bun's localhost listener can fall back to the other address family when one
// is busy. Nitro detects readiness by binding localhost, so reserve both loopback
// addresses to make that check observe the running proxy.
const servers = (host === "localhost" ? ["127.0.0.1", "::1"] : [host]).map((address) => {
  const server = createServer((incoming, outgoing) => void proxy(incoming, outgoing));
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (address === "::1" && ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code ?? "")) return;
    console.error(`[docs preview] ${error.message}`);
    stop(1);
  });
  server.listen(publicPort, address);
  return server;
});

runtime.once("exit", (code) => stop(code ?? 1));
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
